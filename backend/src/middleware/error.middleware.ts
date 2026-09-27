import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { isProd } from "../config/env.js";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { message: err.message, details: err.details ?? null },
    });
  }

  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({ error: { message: "Duplicate value violates a unique field" } });
  }

  console.error("[unhandled error]", err);
  const message = isProd ? "Internal server error" : (err as Error)?.message ?? "Unknown error";
  return res.status(500).json({ error: { message } });
}
