import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { PERMISSION_MODULES } from "../types/permissions.js";

const modulePermissionSchema = new Schema(
  {
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
  },
  { _id: false }
);

const permissionsSchema = new Schema(
  PERMISSION_MODULES.reduce(
    (acc, mod) => {
      acc[mod] = { type: modulePermissionSchema, default: () => ({ view: false, edit: false }) };
      return acc;
    },
    {} as Record<string, unknown>
  ),
  { _id: false }
);

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    // Reversible copy of the current plaintext password, so the Owner can
    // view an admin's password from the Users page. Never returned by
    // default queries — only via the explicit reveal endpoint.
    passwordEncrypted: { type: String, select: false, default: null },
    role: { type: String, enum: ["owner", "admin"], required: true, default: "admin" },
    permissions: { type: permissionsSchema, default: () => ({}) },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    createdBy: { type: Types.ObjectId, ref: "User", default: null },
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User = model("User", userSchema);
