import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";

type Source = "body" | "query" | "params";

export function validate(schema: ZodType, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest("Validation failed", result.error.flatten()));
    }
    if (source === "query") {
      const query = req.query as Record<string, unknown>;
      const parsed = result.data as Record<string, unknown>;
      for (const key of Object.keys(query)) {
        delete query[key];
      }
      Object.assign(query, parsed);
    } else {
      (req as Request & Record<Source, unknown>)[source] = result.data;
    }
    next();
  };
}
