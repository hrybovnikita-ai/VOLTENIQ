import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getCategories,
  getFeaturedProducts,
  getProductById,
  getProductsByIds,
  listProducts,
  suggestProducts,
} from '../services/productService.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await listProducts(req.query);
    res.json({
      success: true,
      data: {
        products: data.products,
        total: data.total,
        categories: data.categories,
        demoPricing: true,
        note: 'All prices are DEMO prices — no real payments.',
      },
    });
  })
);

router.get(
  '/suggest',
  asyncHandler(async (req, res) => {
    const data = await suggestProducts(req.query.q || req.query.search || '', req.query.limit);
    res.json({
      success: true,
      data: {
        ...data,
        demoPricing: true,
        note: 'Demo prices only. Concept labels mark unverified models.',
      },
    });
  })
);

router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const products = await getFeaturedProducts();
    res.json({ success: true, data: { products, demoPricing: true } });
  })
);

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { categories: getCategories() } });
  })
);

router.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 4);
    const products = await getProductsByIds(ids);
    res.json({ success: true, data: { products, demoPricing: true } });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({
      success: true,
      data: { product, demoPricing: true, note: 'DEMO price — no real payment.' },
    });
  })
);

export default router;
