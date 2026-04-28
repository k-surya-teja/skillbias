import { Router } from "express";
import {
  getSettings,
  testAiProvider,
  updateSettings,
} from "../controllers/settingsController.js";
import { requireOrgAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireOrgAuth);
router.get("/", asyncHandler(getSettings));
router.patch("/", asyncHandler(updateSettings));
router.post("/ai/test", asyncHandler(testAiProvider));

export default router;
