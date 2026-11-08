import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  appendMessages,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} from '../services/chatService.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conversations = await listConversations(req.user.id);
    res.json({ success: true, data: { conversations } });
  })
);

router.post(
  '/',
  [body('title').optional().isString().trim().isLength({ max: 80 })],
  validate,
  asyncHandler(async (req, res) => {
    const conversation = await createConversation(req.user.id, {
      title: req.body.title || 'New chat',
    });
    res.status(201).json({ success: true, data: { conversation } });
  })
);

router.get(
  '/:id',
  [param('id').isString().trim().isLength({ min: 1, max: 64 })],
  validate,
  asyncHandler(async (req, res) => {
    const conversation = await getConversation(req.user.id, req.params.id);
    res.json({ success: true, data: { conversation } });
  })
);

router.patch(
  '/:id',
  [
    param('id').isString().trim().isLength({ min: 1, max: 64 }),
    body('title').optional().isString().trim().isLength({ min: 1, max: 80 }),
    body('pinned').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const conversation = await updateConversation(req.user.id, req.params.id, {
      title: req.body.title,
      pinned: req.body.pinned,
    });
    res.json({ success: true, data: { conversation } });
  })
);

router.delete(
  '/:id',
  [param('id').isString().trim().isLength({ min: 1, max: 64 })],
  validate,
  asyncHandler(async (req, res) => {
    const result = await deleteConversation(req.user.id, req.params.id);
    res.json({ success: true, data: result });
  })
);

router.post(
  '/:id/messages',
  [
    param('id').isString().trim().isLength({ min: 1, max: 64 }),
    body('messages').isArray({ min: 1 }).withMessage('messages array required'),
    body('messages.*.role').isIn(['user', 'assistant']),
    body('messages.*.content').isString().trim().isLength({ min: 1, max: 8000 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await appendMessages(req.user.id, req.params.id, req.body.messages);
    res.status(201).json({ success: true, data: result });
  })
);

export default router;
