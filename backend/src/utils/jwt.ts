import jsonwebtoken from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import type { Role } from "../types/permissions.js";

const { sign, verify } = jsonwebtoken;

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const options = { expiresIn: env.jwtAccessExpiresIn } as SignOptions;
  return sign(payload, env.jwtAccessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

/**
 * Refresh tokens are opaque random strings (not signed JWTs) that are stored
 * (as-is) in MongoDB against the user, with an expiry — this lets us revoke
 * individual sessions and rotate on every refresh.
 */
export function generateRefreshTokenString(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function refreshTokenExpiryDate(): Date {
  const days = env.jwtRefreshExpiresInDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
