import { z } from "zod";
import { PERMISSION_MODULES } from "../types/permissions.js";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

const modulePermissionSchema = z.object({
  view: z.boolean().default(false),
  edit: z.boolean().default(false),
});

export const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_MODULES.map((mod) => [mod, modulePermissionSchema])) as Record<
    (typeof PERMISSION_MODULES)[number],
    typeof modulePermissionSchema
  >
);

export const createAdminSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  permissions: permissionsSchema.partial().optional(),
});
export type CreateAdminInput = z.infer<typeof createAdminSchema>;

export const updatePermissionsSchema = z.object({
  permissions: permissionsSchema.partial(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
