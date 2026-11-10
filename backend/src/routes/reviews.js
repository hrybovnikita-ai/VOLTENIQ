import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  createReview,
  deleteReview,
  listReviews,
  updateReview,
} from '../services/reviewService.js';
import { sessionUser } from '../services/sessionService.js';

const router = Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await sessionUser(req).catch(() => null);
    const data = await listReviews(req.params.productId || req.params.id, {
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      userId: user?.id || null,
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  authenticate,
  [
    body('rating').isInt({ min: 1, max: 5 }),
    body('body').trim().isLength({ min: 10, max: 2000 }),
    body('title').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('photos').optional().isArray({ max: 3 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const review = await createReview(req.user.id, req.params.productId || req.params.id, req.body);
    res.status(201).json({ success: true, data: { review } });
  })
);

router.put(
  '/:reviewId',
  authenticate,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('body').optional().trim().isLength({ min: 10, max: 2000 }),
    body('title').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('photos').optional().isArray({ max: 3 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const review = await updateReview(req.user.id, req.params.reviewId, req.body, {
      isAdmin: req.user.role === 'ADMIN',
    });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, data: { review } });
  })
);

router.delete(
  '/:reviewId',
  authenticate,
  asyncHandler(async (req, res) => {
    const ok = await deleteReview(req.user.id, req.params.reviewId, {
      isAdmin: req.user.role === 'ADMIN',
    });
    if (!ok) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, message: 'Review deleted' });
  })
);

export default router;
