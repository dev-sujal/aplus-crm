import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { addPaymentSchema, updateFeeSchema, updatePaymentSchema } from "../validators/fee.validator.js";
import {
  addPayment,
  downloadFeeReceipt,
  getFeeByEnrollment,
  getFeeSummary,
  getNextReceipt,
  listFeesForStudent,
  updateFee,
  updatePayment,
} from "../controllers/fees.controller.js";

const router = Router();

router.use(authenticate, requireRole("owner"));

router.get("/summary", getFeeSummary);
router.get("/next-receipt-number", getNextReceipt);
router.get("/payments/:paymentId/download", downloadFeeReceipt);
router.patch("/payments/:paymentId", validate(updatePaymentSchema), updatePayment);
router.get("/student/:studentId", listFeesForStudent);
router.get("/:enrollmentId", getFeeByEnrollment);
router.patch("/:enrollmentId", validate(updateFeeSchema), updateFee);
router.post("/:enrollmentId/payments", validate(addPaymentSchema), addPayment);

export default router;
