import { isValidObjectId } from "mongoose";
import { User } from "../models/User.model.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { defaultPermissions } from "../types/permissions.js";
import type { ModulePermission, PermissionModule } from "../types/permissions.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import type {
  ChangePasswordInput,
  CreateAdminInput,
  ResetPasswordInput,
} from "../validators/auth.validator.js";

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: "admin" }).sort({ createdAt: -1 });
  res.json(users);
});

export const createAdmin = asyncHandler(async (req: AuthedRequest, res) => {
  const body = req.body as CreateAdminInput;

  const existing = await User.findOne({ email: body.email });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const passwordHash = await hashPassword(body.password);
  const passwordEncrypted = encryptSecret(body.password);
  const permissions = { ...defaultPermissions(), ...(body.permissions ?? {}) };

  const admin = await User.create({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    passwordHash,
    passwordEncrypted,
    role: "admin",
    permissions,
    status: "active",
    createdBy: req.user!.id,
    mustChangePassword: true,
  });

  res.status(201).json(admin);
});

export const updatePermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body as { permissions: Record<string, { view: boolean; edit: boolean }> };

  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid admin id");

  const admin = await User.findOne({ _id: id, role: "admin" });
  if (!admin) throw ApiError.notFound("Admin not found");

  const adminPermissions = admin.permissions as unknown as Record<PermissionModule, ModulePermission>;
  for (const [mod, val] of Object.entries(permissions) as [PermissionModule, ModulePermission][]) {
    adminPermissions[mod] = { ...adminPermissions[mod], ...val };
  }
  await admin.save();
  res.json(admin);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: "active" | "disabled" };

  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid admin id");

  const admin = await User.findOneAndUpdate(
    { _id: id, role: "admin" },
    { status },
    { new: true }
  );
  if (!admin) throw ApiError.notFound("Admin not found");
  res.json(admin);
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid admin id");
  const result = await User.deleteOne({ _id: id, role: "admin" });
  if (result.deletedCount === 0) throw ApiError.notFound("Admin not found");
  res.status(204).send();
});

export const revealPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid admin id");
  const admin = await User.findOne({ _id: id, role: "admin" }).select("+passwordEncrypted");
  if (!admin) throw ApiError.notFound("Admin not found");
  if (!admin.passwordEncrypted) {
    throw ApiError.notFound("No stored password for this admin (set before this feature was added)");
  }
  res.json({ password: decryptSecret(admin.passwordEncrypted) });
});

export const resetAdminPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body as ResetPasswordInput;

  if (!isValidObjectId(id)) throw ApiError.badRequest("Invalid admin id");

  const admin = await User.findOne({ _id: id, role: "admin" });
  if (!admin) throw ApiError.notFound("Admin not found");

  admin.passwordHash = await hashPassword(password);
  admin.passwordEncrypted = encryptSecret(password);
  admin.mustChangePassword = true;
  await admin.save();
  res.status(204).send();
});

export const changeOwnPassword = asyncHandler(async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  const user = await User.findById(req.user!.id).select("+passwordHash");
  if (!user) throw ApiError.notFound("User not found");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest("Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  user.passwordEncrypted = encryptSecret(newPassword);
  user.mustChangePassword = false;
  await user.save();
  res.status(204).send();
});
