import { Schema, model, Types, type InferSchemaType } from "mongoose";

const paymentSchema = new Schema(
  {
    date: { type: Date, default: () => new Date() },
    amount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ["cash", "upi", "card", "bank_transfer", "other", "online", "offline"],
      default: "cash",
    },
    note: { type: String, default: "" },
    receiptNo: { type: String, default: "" },
  },
  { _id: true }
);

const feeSchema = new Schema(
  {
    enrollment: { type: Types.ObjectId, ref: "Enrollment", required: true, unique: true },
    totalFee: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    amountRemaining: { type: Number, required: true, min: 0, default: 0 },
    dueDate: { type: Date, default: null },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true }
);

feeSchema.index({ dueDate: 1 });

export type FeeDoc = InferSchemaType<typeof feeSchema>;

export const Fee = model("Fee", feeSchema);
