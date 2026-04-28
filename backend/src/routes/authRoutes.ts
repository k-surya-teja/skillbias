import { Router } from "express";
import rateLimit from "express-rate-limit";
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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

router.post("/signup", authLimiter, asyncHandler(signup));
router.post("/login", authLimiter, asyncHandler(login));
router.get("/google", googleAuth);
router.get("/google/callback", asyncHandler(googleCallback));
router.post("/logout", logout);
router.get("/me", requireOrgAuth, asyncHandler(me));

export default router;
