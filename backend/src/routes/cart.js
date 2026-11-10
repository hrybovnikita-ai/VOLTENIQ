import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { clearCart, getCart, saveCart } from '../services/cartService.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getCart(req.user.id);
    res.json({ success: true, data: cart });
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const { items, version } = req.body ?? {};
    try {
      const cart = await saveCart(req.user.id, { items, version });
      res.json({ success: true, data: cart });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({ success: false, message: error.message });
      }
      throw error;
    }
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await clearCart(req.user.id);
    res.json({ success: true, data: cart });
  })
);

export default router;
