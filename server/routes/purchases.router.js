import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buySubscription, getTransactionsAndSubs } from "../tableModels/purchases.service.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const result = await getTransactionsAndSubs();
  res.json(result);
}));

router.post("/subscriptions", asyncHandler(async (req, res) => {
  const result = await buySubscription(req.body);
  res.status(201).json(result);
}));

export default router;