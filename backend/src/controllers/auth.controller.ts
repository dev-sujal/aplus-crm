import type { Response } from "express";
import { User } from "../models/User.model.js";
import { RefreshToken } from "../models/RefreshToken.model.js";
import { verifyPassword } from "../utils/password.js";
import {
  generateRefreshTokenString,
  refreshTokenExpiryDate,
  signAccessToken,
} from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { LoginInput } from "../validators/auth.validator.js";
import { env, isProd } from "../config/env.js";
import type { AuthedRequest } from "../middleware/auth.middleware.js";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    expires: expiresAt,
    path: "/api/v1/auth",
  });
}

async function issueTokens(
  res: Response,
  user: { id: string; role: "owner" | "admin"; email: string },
  meta: { ip: string | null; userAgent: string | null }
) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = generateRefreshTokenString();
  const expiresAt = refreshTokenExpiryDate();

  await RefreshToken.create({
    userId: user.id,
    token: refreshToken,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  setRefreshCookie(res, refreshToken, expiresAt);
  return accessToken;
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw ApiError.unauthorized("Invalid email or password");
  if (user.status !== "active") throw ApiError.forbidden("This account has been disabled");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const accessToken = await issueTokens(
    res,
    { id: user.id, role: user.role as "owner" | "admin", email: user.email },
    { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null }
  );

  res.json({
    accessToken,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized("Missing refresh token");

  const stored = await RefreshToken.findOne({ token });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token invalid or expired");
  }

  const user = await User.findById(stored.userId);
  if (!user || user.status !== "active") {
    throw ApiError.unauthorized("Account no longer active");
  }

  // Rotate: revoke old, issue new.
  const newAccessToken = signAccessToken({
    sub: user.id,
    role: user.role as "owner" | "admin",
    email: user.email,
  });
  const newRefreshToken = generateRefreshTokenString();
  const expiresAt = refreshTokenExpiryDate();

  stored.revokedAt = new Date();
  stored.replacedByToken = newRefreshToken;
  await stored.save();

  await RefreshToken.create({
    userId: user.id,
    token: newRefreshToken,
    expiresAt,
    ip: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });

  setRefreshCookie(res, newRefreshToken, expiresAt);
  res.json({ accessToken: newAccessToken });
});

export const logout = asyncHandler(async (req, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await RefreshToken.updateOne({ token }, { revokedAt: new Date() });
  }
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  res.status(204).send();
});

export const me = asyncHandler(async (req: AuthedRequest, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw ApiError.notFound("User not found");
  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    status: user.status,
  });
});

export { issueTokens };
