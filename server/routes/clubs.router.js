import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getClubs,
  getClubById,
  addClub,
  addZoneForClub,
  patchClubById,
  deleteClubById,
} from "../tableModels/clubs.service.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const result = await getClubs();
  res.json(result);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getClubById(req.params.id);
  res.json(result);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const result = await patchClubById(req.params.id, req.body);
  res.json(result);
}));

router.post("/", asyncHandler(async(req,res)=>{
  const result = await addClub(req.body)
  res.status(201).json(result);
}))

router.post("/:id/zones", asyncHandler(async(req,res)=>{
  const result = await addZoneForClub(req.params.id, req.body)
  res.status(201).json(result);
}))

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteClubById(req.params.id);
  res.status(204).send();
}));

export default router;