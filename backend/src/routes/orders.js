import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { createOrder, getOrderById, getOrdersByUser } from '../services/orderService.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await getOrdersByUser(req.user.id);
    res.json({ success: true, data: { orders } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await getOrderById(req.params.id, req.user.id, req.user.role === 'ADMIN');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: { order } });
  })
);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.productId').notEmpty().withMessage('Product id required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('shipping.name').trim().notEmpty().withMessage('Shipping name required'),
    body('shipping.address').trim().notEmpty().withMessage('Shipping address required'),
    body('shipping.city').trim().notEmpty().withMessage('City required'),
    body('shipping.zip').trim().notEmpty().withMessage('ZIP required'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const order = await createOrder(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Demo order placed — no payment was processed.',
      data: { order },
    });
  })
);

export default router;
