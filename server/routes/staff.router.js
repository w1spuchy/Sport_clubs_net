import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createTrainer, createAdmin } from "../tableModels/staff.service.js";

const router = express.Router();

router.post("/trainers", asyncHandler(async (req, res) => {
  const result = await createTrainer(req.body);
  res.status(201).json(result);
}));

router.post("/admins", asyncHandler(async (req, res) => {
  const result = await createAdmin(req.body);
  res.status(201).json(result);
}));

export default router;