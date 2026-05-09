import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cancelSubscription } from '../tableModels/activeSubscriptions.service.js';

const router = express.Router();

router.patch("/:id/cancel", asyncHandler(async (req, res) => {
  const result = await cancelSubscription(req.params.id);
  res.json(result);
}));

export default router;
