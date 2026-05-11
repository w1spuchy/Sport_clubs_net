import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createTraining,
  patchTraining,
  deleteTraining,
  registerForTraining,
  cancelRegistration
} from "../tableModels/training.services.js";

const router = express.Router();

router.post("/", asyncHandler(async (req, res) => {
  const result = await createTraining(req.body);
  res.status(201).json(result);
}));

router.post("/:idTraining/registrations", asyncHandler(async (req, res) => {
  const result = await registerForTraining(req.params.idTraining, req.body);
  res.status(201).json(result);
}));

router.patch("/:idTraining", asyncHandler(async (req, res) => {
  const result = await patchTraining(req.params.idTraining, req.body);
  res.json(result);
}));

router.delete("/registrations", asyncHandler(async (req, res) => {
  const result = await cancelRegistration(req.body.idRegistrationForClass);
  res.status(201).json(result);
}));

router.delete("/:idTraining", asyncHandler(async (req, res) => {
  await deleteTraining(req.params.idTraining);
  res.status(204).send();
}));


export default router;