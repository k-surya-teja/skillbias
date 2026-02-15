import { Router } from "express";
import {
  createJob,
  deleteJob,
  exportJobApplications,
  getJobApplications,
  getJobById,
  listJobs,
  updateJob,
} from "../controllers/jobController.js";
import { requireOrgAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireOrgAuth);
router.post("/create", asyncHandler(createJob));
router.get("/", asyncHandler(listJobs));
router.get("/:id", asyncHandler(getJobById));
router.put("/:id", asyncHandler(updateJob));
router.delete("/:id", asyncHandler(deleteJob));
router.get("/:id/applications", asyncHandler(getJobApplications));
router.get("/:id/export", asyncHandler(exportJobApplications));

export default router;
