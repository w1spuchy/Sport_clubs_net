import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { cancelSubscription, expireSubscriptions } from '../tableModels/activeSubscriptions.service.js';

const router = express.Router();

router.patch("/expire", asyncHandler(async (req, res) => {
  const result = await expireSubscriptions();
  res.json(result);
}));

router.patch("/:id/cancel", asyncHandler(async (req, res) => {
  const result = await cancelSubscription(req.params.id);
  res.json(result);
}));

export default router;
