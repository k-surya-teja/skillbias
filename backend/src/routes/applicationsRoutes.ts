import { Router } from "express";
import { updateApplication } from "../controllers/applicationController.js";
import { requireOrgAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireOrgAuth);
router.patch("/:id", asyncHandler(updateApplication));

export default router;
