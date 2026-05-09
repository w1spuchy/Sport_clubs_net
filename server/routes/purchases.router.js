import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buySubscription } from "../tableModels/purchases.service.js";

const router = express.Router();

router.post("/subscriptions", asyncHandler(async (req, res) => {
  const result = await buySubscription(req.body);
  res.status(201).json(result);
}));

export default router;