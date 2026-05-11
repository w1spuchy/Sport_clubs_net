import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createSubscriptionPlan,
  replaceZoneAccessForSubType,
} from "../tableModels/subscription.service.js";

const router = express.Router();

router.post("/subscription-plans", asyncHandler(async (req, res) => {
  const result = await createSubscriptionPlan(req.body);
  res.status(201).json(result);
}));

router.put("/sub-types/:subType/zone-access", asyncHandler(async (req, res) => {
  const result = await replaceZoneAccessForSubType(req.params.subType, req.body);
  res.json(result);
}));

export default router;