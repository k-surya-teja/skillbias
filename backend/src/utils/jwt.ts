import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { OrganizationJwtPayload } from "../types/index.js";

const COOKIE_NAME = "org_token";

export function signOrganizationToken(payload: OrganizationJwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyOrganizationToken(token: string): OrganizationJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as OrganizationJwtPayload;
}

export function getAuthCookieName(): string {
  return COOKIE_NAME;
}
