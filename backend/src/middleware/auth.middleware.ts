import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.model.js";
import type { ModulePermission, PermissionModule, Role } from "../types/permissions.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: Role;
    email: string;
  };
}

/** Verifies the access token from the Authorization header. */
export async function authenticate(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing access token");
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

/** Restricts a route to one or more roles (e.g. requireRole("owner")). */
export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

/**
 * Restricts a route to users who can access a given module.
 * Owners always pass. Admins need permissions[module][action] === true.
 */
export function requirePermission(module: PermissionModule, action: "view" | "edit" = "view") {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === "owner") return next();

    const admin = await User.findById(req.user.id).select("permissions status").lean();
    if (!admin || admin.status !== "active") {
      return next(ApiError.forbidden("Account disabled"));
    }
    const permissions = admin.permissions as unknown as Record<PermissionModule, ModulePermission>;
    const perm = permissions?.[module];
    if (!perm || !perm[action]) {
      return next(ApiError.forbidden(`Missing ${action} permission for ${module}`));
    }
    next();
  };
}
