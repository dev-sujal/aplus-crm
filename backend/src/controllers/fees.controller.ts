import mongoose from "mongoose";
import { Fee } from "../models/Fee.model.js";
import { Enrollment } from "../models/Enrollment.model.js";
import { ensureFeeForEnrollment } from "../utils/fee.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AddPaymentInput, UpdateFeeInput } from "../validators/fee.validator.js";

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

export const getFeeByEnrollment = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.enrollmentId).populate("course", "fee");
  if (!enrollment) throw ApiError.notFound("Enrollment not found");

  const course = enrollment.course as unknown as { fee: number } | null;
  const fee = await ensureFeeForEnrollment(enrollment.id, course?.fee ?? 0);
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
  const fee = await ensureFeeForEnrollment(enrollmentId, course?.fee ?? 0);

  fee.payments.push({
    amount: body.amount,
    mode: body.mode,
    note: body.note,
    receiptNo: body.receiptNo,
    date: body.date ?? new Date(),
  });
  fee.amountPaid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
  fee.amountRemaining = Math.max(fee.totalFee - fee.amountPaid, 0);
  await fee.save();

  res.status(201).json(fee);
});

export const updateFee = asyncHandler(async (req, res) => {
  const enrollmentId = req.params.enrollmentId as string;
  const body = req.body as UpdateFeeInput;

  const fee = await Fee.findOne({ enrollment: enrollmentId });
  if (!fee) throw ApiError.notFound("Fee record not found");

  if (body.totalFee !== undefined) fee.totalFee = body.totalFee;
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
