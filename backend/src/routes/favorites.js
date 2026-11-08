import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { listFavorites, toggleFavorite } from '../services/favoriteService.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const favorites = await listFavorites(req.user.id);
    res.json({ success: true, data: { favorites } });
  })
);

router.post(
  '/toggle',
  [body('productId').isString().bail().trim().isLength({ min: 1, max: 100 }).withMessage('Invalid product ID')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await toggleFavorite(req.user.id, req.body.productId);
    res.json({ success: true, data: result });
  })
);

export default router;
