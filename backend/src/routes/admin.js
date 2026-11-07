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
import { listAllOrders, updateOrderStatus } from '../services/orderService.js';
import { listUsers } from '../services/userService.js';

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
    const order = await updateOrderStatus(req.params.id, req.body.status);
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

export default router;
