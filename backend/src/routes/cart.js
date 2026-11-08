import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { mongo, unavailable, variantKeys } from '../db/mongo.js';
import { getProductsByIds } from '../services/productService.js';

const router = Router();
router.use(authenticate);
function validItem(item) {
  return item && typeof item.productId === 'string' && item.productId.length > 0 && item.productId.length <= 100
    && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 999
    && item.selection && typeof item.selection === 'object' && !Array.isArray(item.selection)
    && Object.entries(item.selection).every(([key, value]) => variantKeys.includes(key) && typeof value === 'string' && value.length > 0 && value.length <= 120)
    && Object.keys(item).every(key => ['productId','quantity','selection'].includes(key));
}
router.get('/', asyncHandler(async (req, res) => {
  const { db } = await mongo();
  const cart = await db.collection('carts').findOne({ _id: req.user.id }).catch(() => { throw unavailable(); });
  res.json({ success: true, data: { version: cart?.version ?? 0, items: cart?.items ?? [] } });
}));
router.put('/', asyncHandler(async (req, res) => {
  const { items, version } = req.body ?? {};
  if (!Array.isArray(items) || items.length > 100 || !items.every(validItem) || !Number.isSafeInteger(version) || version < 0)
    return res.status(400).json({ success: false, message: 'Invalid cart items or version.' });
  const { db } = await mongo();
  const ids = [...new Set(items.map(i => i.productId))];
  if (ids.length && (await getProductsByIds(ids)).length !== ids.length)
    return res.status(400).json({ success: false, message: 'A product is no longer available.' });
  const result = await db.collection('carts').updateOne({ _id: req.user.id, version },
    { $set: { items, updatedAt: new Date() }, $inc: { version: 1 } }, { upsert: version === 0 })
    .catch(error => { if (error.code === 11000) return {}; throw unavailable(); });
  if (!result.matchedCount && !result.upsertedCount)
    return res.status(409).json({ success: false, message: 'Cart changed. Reload the saved cart and retry.' });
  res.json({ success: true, data: { version: version + 1 } });
}));
export default router;
