import mongoose from "mongoose";
import { Fee } from "../models/Fee.model.js";

export function validatePaymentAmount(amount: number, remaining: number) {
  if (amount <= 0) {
    throw new Error("Payment amount must be greater than 0");
  }

  if (remaining <= 0) {
    throw new Error("This fee is already fully paid");
  }

  if (amount > remaining) {
    throw new Error("Payment amount cannot exceed the remaining balance");
  }
}

export function validateFeeCap(totalFee: number, courseFee: number) {
  if (totalFee > courseFee) {
    throw new Error(`Fee total cannot exceed the course fee (${courseFee})`);
  }
}

export async function ensureFeeForEnrollment(enrollmentId: string, totalFee: number) {
  const enrollmentObjectId = new mongoose.Types.ObjectId(enrollmentId);
  const existing = await Fee.findOne({ enrollment: enrollmentObjectId });
  if (existing) return existing;
  return Fee.create({
    enrollment: enrollmentObjectId,
    totalFee,
    amountPaid: 0,
    amountRemaining: totalFee,
    payments: [],
  });
}
