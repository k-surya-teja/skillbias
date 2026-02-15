import { Router } from "express";
import { submitApplication } from "../controllers/applicationController.js";
import { getPublicJob } from "../controllers/jobController.js";
import { resumeUpload } from "../config/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/apply/:jobId", asyncHandler(getPublicJob));
router.post("/apply/:jobId", resumeUpload.single("resume"), asyncHandler(submitApplication));

export default router;
