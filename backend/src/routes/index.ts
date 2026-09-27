import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./users.routes.js";
import courseRoutes from "./courses.routes.js";
import studentRoutes from "./students.routes.js";
import enrollmentRoutes from "./enrollments.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import feeRoutes from "./fees.routes.js";
import certificateRoutes from "./certificates.routes.js";
import verifyRoutes from "./verify.routes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true, service: "aplus-crm-api" }));

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/courses", courseRoutes);
router.use("/students", studentRoutes);
router.use("/enrollments", enrollmentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/fees", feeRoutes);
router.use("/certificates", certificateRoutes);
router.use("/verify", verifyRoutes);

export default router;
