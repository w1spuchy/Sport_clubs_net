import express from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { checkIn, checkOut, getClientVisits } from '../tableModels/visits.service.js';

const router = express.Router();

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getClientVisits(req.params.id);
  res.json(result);
}));

router.post("/check-in", asyncHandler(async (req, res) => {
  const result = await checkIn(req.body);
  res.status(201).json(result);
}));

router.patch("/:idVisit/check-out", asyncHandler(async (req, res) => {
  const result = await checkOut(req.params.idVisit);
  res.json(result);
}));

export default router;