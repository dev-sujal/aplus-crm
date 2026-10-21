import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError.js";

type Source = "body" | "query" | "params";

function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const first = error.issues[0];
  if (!first) return "Validation failed";
  const field = first.path.map(String).join(".");
  return field ? `Validation failed: ${field} - ${first.message}` : `Validation failed: ${first.message}`;
}

export function validate(schema: ZodType, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest(describeIssues(result.error), result.error.flatten()));
    }
    // Express 5 exposes req.query as a getter that re-parses the URL on every
    // access, so mutating it is a no-op. Redefine it as a plain property so the
    // parsed values (coerced numbers, defaults) actually reach the controllers.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
