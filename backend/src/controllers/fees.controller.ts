import mongoose from "mongoose";
import { Fee } from "../models/Fee.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import { ensureFeeForEnrollment, validateFeeCap, validatePaymentAmount } from "../utils/fee.js";
import { generateFeeReceiptPdf } from "../utils/feeReceiptPdf.js";
import { getNextReceiptNumber } from "../utils/receiptNumber.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type {
  AddPaymentInput,
  UpdateFeeInput,
  UpdatePaymentInput,
} from "../validators/fee.validator.js";

const populateRefs = [
  {
    path: "enrollment",
    populate: [
      { path: "student", select: "firstName lastName" },
      { path: "course", select: "title fee" },
    ],
  },
];

function getObjectId(value: unknown) {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  return typeof value === "string" ? value : "";
}

async function buildNextReceiptNumber() {
  const fees = await Fee.find({}, { payments: 1 });
  const existingNumbers = fees.flatMap((fee) => fee.payments.map((payment) => payment.receiptNo));
  return getNextReceiptNumber(existingNumbers);
}

export const getNextReceipt = asyncHandler(async (_req, res) => {
  res.json({ receiptNo: await buildNextReceiptNumber() });
});

export const getFeeByEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.enrollmentId).populate("course", "fee");
  if (!enrollment) throw ApiError.notFound("Enrollment not found");

  const course = enrollment.course as unknown as { fee: number } | null;
  const fee = await ensureFeeForEnrollment(enrollment.id, enrollment.fee ?? course?.fee ?? 0);
  res.json(fee);
});

export const listFeesForStudent = asyncHandler(async (req, res) => {
  const studentId = new mongoose.Types.ObjectId(req.params.studentId as string);
  const enrollments = await Enrollment.find({ student: studentId });
  const enrollmentIds = enrollments.map((e) => e.id);
  const fees = await Fee.find({ enrollment: { $in: enrollmentIds } }).populate(populateRefs);
  res.json(fees);
});

export const addPayment = asyncHandler(async (req, res) => {
  const enrollmentId = req.params.enrollmentId as string;
  const body = req.body as AddPaymentInput;

  const enrollment = await Enrollment.findById(enrollmentId).populate("course", "fee");
  if (!enrollment) throw ApiError.notFound("Enrollment not found");
  const course = enrollment.course as unknown as { fee: number } | null;
  const fee = await ensureFeeForEnrollment(enrollmentId, enrollment.fee ?? course?.fee ?? 0);

  validatePaymentAmount(body.amount, fee.amountRemaining);

  const trimmedReceiptNo = (body.receiptNo ?? "").trim();
  const requestedReceiptNo = trimmedReceiptNo || (await buildNextReceiptNumber());
  const receiptTaken = await Fee.exists({ "payments.receiptNo": requestedReceiptNo });
  if (receiptTaken) {
    throw ApiError.conflict("Receipt number already exists");
  }

  fee.payments.push({
    amount: body.amount,
    mode: body.mode,
    note: body.note,
    receiptNo: requestedReceiptNo,
    date: body.date ?? new Date(),
  });
  fee.amountPaid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
  fee.amountRemaining = Math.max(fee.totalFee - fee.amountPaid, 0);

  if (fee.amountPaid > fee.totalFee) {
    throw ApiError.badRequest("Collected amount cannot exceed the fee total");
  }

  await fee.save();

  res.status(201).json(fee);
});

export const downloadFeeReceipt = asyncHandler(async (req, res) => {
  const paymentId = req.params.paymentId as string;
  const fee = await Fee.findOne({ "payments._id": paymentId }).populate(populateRefs);
  if (!fee) throw ApiError.notFound("Payment receipt not found");

  const payment = fee.payments.id(paymentId);
  if (!payment) throw ApiError.notFound("Payment receipt not found");

  const enrollment = fee.enrollment as unknown as {
    student?: { firstName?: string; lastName?: string };
    course?: { title?: string };
  } | null;

  const pdfBytes = await generateFeeReceiptPdf({
    studentName: enrollment?.student
      ? `${enrollment.student.firstName ?? ""} ${enrollment.student.lastName ?? ""}`.trim()
      : "Student",
    courseName: enrollment?.course?.title ?? "Course",
    receiptNo: payment.receiptNo || paymentId,
    amount: payment.amount,
    mode: payment.mode,
    note: payment.note || "",
    paymentDate: payment.date,
    totalFee: fee.totalFee,
    amountPaid: fee.amountPaid,
    amountRemaining: fee.amountRemaining,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="receipt-${payment.receiptNo || paymentId}.pdf"`
  );
  res.send(Buffer.from(pdfBytes));
});

export const updatePayment = asyncHandler(async (req, res) => {
  const paymentId = req.params.paymentId as string;
  const body = req.body as UpdatePaymentInput;

  const fee = await Fee.findOne({ "payments._id": paymentId });
  if (!fee) throw ApiError.notFound("Payment not found");

  const payment = fee.payments.id(paymentId);
  if (!payment) throw ApiError.notFound("Payment not found");

  const nextAmount = body.amount ?? payment.amount;
  const nextAmountPaid = fee.amountPaid - payment.amount + nextAmount;

  if (nextAmount <= 0) {
    throw ApiError.badRequest("Payment amount must be greater than 0");
  }

  if (nextAmountPaid > fee.totalFee) {
    throw ApiError.badRequest("Collected amount cannot exceed the fee total");
  }

  payment.amount = nextAmount;
  if (body.mode !== undefined) payment.mode = body.mode;
  if (body.note !== undefined) payment.note = body.note;
  if (body.date !== undefined && body.date !== null) payment.date = body.date;

  fee.amountPaid = nextAmountPaid;
  fee.amountRemaining = Math.max(fee.totalFee - fee.amountPaid, 0);
  await fee.save();

  res.json(fee);
});

export const updateFee = asyncHandler(async (req, res) => {
  const enrollmentId = req.params.enrollmentId as string;
  const body = req.body as UpdateFeeInput;

  const fee = await Fee.findOne({ enrollment: enrollmentId });
  if (!fee) throw ApiError.notFound("Fee record not found");

  const enrollment = await Enrollment.findById(enrollmentId).populate("course", "fee");
  const course = enrollment?.course as unknown as { fee: number } | null;
  const maxAllowedFee = Number(enrollment?.fee ?? course?.fee ?? fee.totalFee ?? 0);

  if (body.totalFee !== undefined) {
    validateFeeCap(body.totalFee, maxAllowedFee);
    if (body.totalFee < fee.amountPaid) {
      throw ApiError.badRequest("Total fee cannot be lower than the amount already collected");
    }
    fee.totalFee = body.totalFee;
  }

  if (body.dueDate !== undefined) fee.dueDate = body.dueDate;
  fee.amountRemaining = Math.max(fee.totalFee - fee.amountPaid, 0);
  await fee.save();

  res.json(fee);
});

export const getFeeSummary = asyncHandler(async (_req, res) => {
  const fees = await Fee.find().populate(populateRefs);
  const totalCollected = fees.reduce((sum, f) => sum + f.amountPaid, 0);
  const totalPending = fees.reduce((sum, f) => sum + f.amountRemaining, 0);

  const recentPayments = fees
    .flatMap((fee) => {
      const enrollment = fee.enrollment as unknown as {
        id?: string;
        student?: { id?: string; firstName?: string; lastName?: string };
        course?: { title?: string };
      } | null;
      return fee.payments.map((payment) => ({
        id: payment._id.toString(),
        feeId: fee.id,
        enrollmentId: enrollment?.id ?? getObjectId(fee.enrollment),
        studentId: enrollment?.student?.id ?? "",
        studentName: enrollment?.student
          ? `${enrollment.student.firstName ?? ""} ${enrollment.student.lastName ?? ""}`.trim()
          : "",
        courseName: enrollment?.course?.title ?? "",
        amount: payment.amount,
        mode: payment.mode,
        note: payment.note,
        receiptNo: payment.receiptNo,
        date: payment.date,
      }));
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const now = new Date();
  const overdue = await Fee.find({ dueDate: { $lt: now }, amountRemaining: { $gt: 0 } }).populate([
    {
      path: "enrollment",
      populate: [
        { path: "student", select: "firstName lastName" },
        { path: "course", select: "title" },
      ],
    },
  ]);

  res.json({
    totalCollected,
    totalPending,
    overdueCount: overdue.length,
    overdue,
    recentPayments,
  });
});
