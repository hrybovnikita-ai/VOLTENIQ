import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  getPriceHistory,
  listAlertsForUser,
  listNotifications,
  simulateDemoPriceDrop,
  subscribePriceAlert,
  unsubscribePriceAlert,
} from '../services/alertService.js';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const alerts = await listAlertsForUser(req.user.id);
    res.json({ success: true, data: { alerts } });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await listNotifications(req.user.id);
    res.json({ success: true, data: { notifications } });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/history/:productId',
  [param('productId').notEmpty(), validate],
  async (req, res, next) => {
    try {
      const history = await getPriceHistory(req.params.productId);
      res.json({ success: true, data: { history } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  authenticate,
  [
    body('productId').notEmpty().withMessage('productId required'),
    body('targetPrice').optional({ nullable: true }).isFloat({ min: 0 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const alert = await subscribePriceAlert(
        req.user.id,
        req.body.productId,
        req.body.targetPrice ?? null
      );
      res.status(201).json({
        success: true,
        message: 'Price drop alert saved',
        data: { alert },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id',
  authenticate,
  [param('id').notEmpty(), validate],
  async (req, res, next) => {
    try {
      await unsubscribePriceAlert(req.user.id, req.params.id);
      res.json({ success: true, message: 'Alert removed' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/demo-drop/:productId',
  authenticate,
  [param('productId').notEmpty(), validate],
  async (req, res, next) => {
    try {
      const result = await simulateDemoPriceDrop(req.params.productId, req.body?.percent);
      // Refresh alert notifications for this user
      await listAlertsForUser(req.user.id);
      res.json({
        success: true,
        message: 'Demo price reduced for alert testing — not a real discount.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
