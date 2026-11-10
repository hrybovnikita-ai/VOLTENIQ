import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getProductById } from '../services/productService.js';
import { getUnitPrice } from '../utils/pricing.js';
import { validatePromoForCart } from '../services/promoService.js';

const router = Router();

router.post(
  '/validate',
  authenticate,
  [
    body('code').trim().notEmpty().withMessage('Promo code required'),
    body('items').isArray({ min: 1 }).withMessage('Cart items required'),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const lineItems = [];
    for (const item of req.body.items) {
      const product = await getProductById(item.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      }
      const selections = item.configuration && typeof item.configuration === 'object' ? item.configuration : {};
      const unitPrice = getUnitPrice(product, selections);
      lineItems.push({
        productId: product.id,
        quantity: Number(item.quantity),
        price: unitPrice,
      });
    }

    const result = await validatePromoForCart(req.user.id, req.body.code, lineItems);
    res.json({ success: true, data: result });
  })
);

export default router;
