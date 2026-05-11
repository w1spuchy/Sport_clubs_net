import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getClubs,
  getClubById,
  patchClubById,
  deleteClubByIdSafe,
} from "../tableModels/clubs.service.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const clubs = await getClubs();
  res.json(clubs);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const club = await getClubById(req.params.id);
  res.json(club);
}));

router.patch("/:id", asyncHandler(async (req, res) => {
  const updated = await patchClubById(req.params.id, req.body);
  res.json(updated);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  await deleteClubByIdSafe(req.params.id);
  res.status(204).send();
}));

export default router;