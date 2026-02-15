import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: "Validation failed", details: error.message });
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({ message: error.message });
    return;
  }

  res.status(500).json({ message: "Internal server error" });
}
