import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, refresh } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { loginSchema } from "../validators/auth.validator.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
