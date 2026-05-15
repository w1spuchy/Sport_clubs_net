import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createTrainer, createAdmin, getEmployees, getTrainers, getAdmins, getEmployeeById } from "../tableModels/staff.service.js";

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const result = await getEmployees();
  res.json(result);
}));

router.get("/trainers", asyncHandler(async (req, res) => {
  const result = await getTrainers();
  res.json(result);
}));

router.get("/admins", asyncHandler(async (req, res) => {
  const result = await getAdmins();
  res.json(result);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await getEmployeeById(req.params.id);
  res.json(result);
}));

router.post("/trainers", asyncHandler(async (req, res) => {
  const result = await createTrainer(req.body);
  res.status(201).json(result);
}));

router.post("/admins", asyncHandler(async (req, res) => {
  const result = await createAdmin(req.body);
  res.status(201).json(result);
}));


export default router;