import mongoose from "mongoose";
import { Fee } from "../models/Fee.model.js";

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
