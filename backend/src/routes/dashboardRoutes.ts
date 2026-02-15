import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import { requireOrgAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireOrgAuth);
router.get("/stats", asyncHandler(getDashboardStats));

export default router;
