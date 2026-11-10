import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from '../services/productService.js';
import { listAllOrders, updateOrderStatus, updateOrderTracking } from '../services/orderService.js';
import { listUsers } from '../services/userService.js';
import { listAllReviews, moderateReview, deleteReview } from '../services/reviewService.js';
import { createPromo, deletePromo, listPromos, updatePromo } from '../services/promoService.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [{ products, total }, orders, users] = await Promise.all([
      listProducts({}),
      listAllOrders(),
      listUsers(),
    ]);

    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    res.json({
      success: true,
      data: {
        stats: {
          products: total,
          orders: orders.length,
          users: users.length,
          revenue: Math.round(revenue * 100) / 100,
          featured: products.filter((p) => p.featured).length,
        },
      },
    });
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const data = await listProducts(req.query);
    res.json({ success: true, data });
  })
);

router.post(
  '/products',
  [
    body('name').trim().notEmpty(),
    body('slug').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('image').trim().notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body);
    res.status(201).json({ success: true, data: { product } });
  })
);

router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await updateProduct(req.params.id, req.body);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: { product } });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const ok = await deleteProduct(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted' });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const orders = await listAllOrders();
    res.json({ success: true, data: { orders } });
  })
);

router.patch(
  '/orders/:id/status',
  [body('status').notEmpty().withMessage('Status required')],
  validate,
  asyncHandler(async (req, res) => {
    const order = await updateOrderStatus(req.params.id, req.body.status, req.user.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: { order } });
  })
);

router.patch(
  '/orders/:id/tracking',
  asyncHandler(async (req, res) => {
    const order = await updateOrderTracking(req.params.id, {
      status: req.body.status,
      trackingNumber: req.body.trackingNumber,
      estimatedDelivery: req.body.estimatedDelivery,
      note: req.body.note,
      adminId: req.user.id,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    res.json({ success: true, data: { order } });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const users = await listUsers();
    res.json({ success: true, data: { users } });
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const data = await listAllReviews({
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  })
);

router.patch(
  '/reviews/:id',
  [body('status').notEmpty().withMessage('Status required')],
  validate,
  asyncHandler(async (req, res) => {
    const review = await moderateReview(req.params.id, req.body.status);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.json({ success: true, data: { review } });
  })
);

router.delete(
  '/reviews/:id',
  asyncHandler(async (req, res) => {
    const ok = await deleteReview(req.user.id, req.params.id, { isAdmin: true });
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    res.json({ success: true, message: 'Review deleted' });
  })
);

router.get(
  '/promos',
  asyncHandler(async (req, res) => {
    const promos = await listPromos();
    res.json({ success: true, data: { promos } });
  })
);

router.post(
  '/promos',
  [
    body('code').trim().notEmpty(),
    body('type').isIn(['PERCENTAGE', 'FIXED']),
    body('value').isFloat({ gt: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const promo = await createPromo(req.body);
    res.status(201).json({ success: true, data: { promo } });
  })
);

router.put(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const promo = await updatePromo(req.params.id, req.body);
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo not found' });
    }
    res.json({ success: true, data: { promo } });
  })
);

router.delete(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const ok = await deletePromo(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Promo not found' });
    }
    res.json({ success: true, message: 'Promo deleted' });
  })
);

export default router;
