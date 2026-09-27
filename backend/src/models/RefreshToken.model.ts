import { Schema, model, Types } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByToken: { type: String, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index: MongoDB will auto-delete expired token documents.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
