import { Router } from "express";
import {
  cancelSubscription,
  createCheckout,
  getBilling,
} from "../controllers/billingController.js";
import { requireOrgAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireOrgAuth);
router.get("/", asyncHandler(getBilling));
router.post("/checkout", asyncHandler(createCheckout));
router.post("/cancel", asyncHandler(cancelSubscription));

export default router;
