import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  googleAuth,
  googleCallback,
  login,
  logout,
  me,
  signup,
} from "../controllers/authController.js";
import { requireOrgAuth } from "../middleware/auth.js";

const router = Router();

router.post("/signup", asyncHandler(signup));
router.post("/login", asyncHandler(login));
router.get("/google", googleAuth);
router.get("/google/callback", asyncHandler(googleCallback));
router.post("/logout", logout);
router.get("/me", requireOrgAuth, asyncHandler(me));

export default router;
