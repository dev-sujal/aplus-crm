import { z } from "zod";

const dateLike = z
  .union([z.string(), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date")
  .nullable()
  .optional();

export const addPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  mode: z
    .enum(["cash", "upi", "card", "bank_transfer", "other", "online", "offline"])
    .optional()
    .default("cash"),
  note: z.string().optional().default(""),
  receiptNo: z.string().optional().default(""),
  date: dateLike,
});
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;

export const updateFeeSchema = z.object({
  totalFee: z.number().min(0).optional(),
  dueDate: dateLike,
});
export type UpdateFeeInput = z.infer<typeof updateFeeSchema>;
