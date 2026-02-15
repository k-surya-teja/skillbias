import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "../types/index.js";
import { getAuthCookieName, verifyOrganizationToken } from "../utils/jwt.js";

export function requireOrgAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[getAuthCookieName()];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    req.organization = verifyOrganizationToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired session" });
  }
}
