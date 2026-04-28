import { NextFunction, Request, Response } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { ZodError } from "zod";

/**
 * Standard error envelope shipped to the client:
 *   { message, code, details? }
 *
 * - message: human-readable, safe to display in toasts/inline.
 * - code:    stable machine-friendly identifier the frontend can branch on.
 * - details: optional structured info (e.g. zod field issues).
 */

type ErrorEnvelope = {
  message: string;
  code: string;
  details?: unknown;
};

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = "http_error", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;

  // Don't try to write to a response that has already been sent.
  if (res.headersSent) return;

  const { status, body } = toEnvelope(error);

  // Log non-4xx with full detail; client errors are usually noise.
  if (status >= 500) {
    console.error("[errorHandler]", req.method, req.originalUrl, error);
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("[errorHandler]", req.method, req.originalUrl, body.code, body.message);
  }

  res.status(status).json(body);
}

function toEnvelope(error: unknown): { status: number; body: ErrorEnvelope } {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: { message: error.message, code: error.code, details: error.details },
    };
  }

  if (error instanceof ZodError) {
    const fieldErrors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const first = error.issues[0]?.message ?? "Validation failed";
    return {
      status: 400,
      body: { message: first, code: "validation_error", details: { fieldErrors } },
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    const first =
      Object.values(error.errors)[0]?.message ?? "Validation failed";
    return {
      status: 400,
      body: { message: first, code: "validation_error" },
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      body: { message: "Invalid identifier", code: "bad_id" },
    };
  }

  if (isMongoDuplicateKeyError(error)) {
    return {
      status: 409,
      body: { message: "Duplicate value", code: "duplicate_key" },
    };
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE" ? "File too large." : "File upload failed.";
    return {
      status: 400,
      body: { message, code: error.code.toLowerCase() },
    };
  }

  if (error instanceof SyntaxError && /JSON/i.test(error.message)) {
    return {
      status: 400,
      body: { message: "Invalid JSON in request body", code: "bad_json" },
    };
  }

  return {
    status: 500,
    body: { message: "Internal server error", code: "internal_error" },
  };
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
