// backend/src/routes/feesRoutes.ts
import { Router } from "express";
import { getFees } from "../controllers/feesController";

const router = Router();
router.get("/", getFees);

export default router;
