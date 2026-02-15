import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clerkSync, login, logout, me, signup } from "../controllers/authController.js";
import { requireOrgAuth } from "../middleware/auth.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.post("/clerk-sync", asyncHandler(clerkSync));
router.post("/logout", logout);
router.get("/me", requireOrgAuth, asyncHandler(me));

export default router;
