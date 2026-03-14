import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";
import { getAuthCookieName, signOrganizationToken } from "../utils/jwt.js";
import { isDuplicateKeyError } from "../utils/mongoErrors.js";

const signupSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  logo: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie(getAuthCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function signup(req: Request, res: Response): Promise<void> {
  const payload = signupSchema.parse(req.body);

  const existing = await OrganizationModel.findOne({ email: payload.email.toLowerCase() });
  if (existing) {
    res.status(409).json({ message: "Organization email already exists" });
    return;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);
  let organization;
  try {
    organization = await OrganizationModel.create({
      companyName: payload.companyName,
      email: payload.email.toLowerCase(),
      password: hashedPassword,
      logo: payload.logo ?? "",
      plan: "free",
      freeJobUsed: false,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(409).json({ message: "Organization email already exists" });
      return;
    }
    throw error;
  }

  const token = signOrganizationToken({
    orgId: String(organization._id),
    email: organization.email,
  });
  setAuthCookie(res, token);

  res.status(201).json({
    organization: {
      id: organization._id,
      companyName: organization.companyName,
      email: organization.email,
      plan: organization.plan,
      freeJobUsed: organization.freeJobUsed,
    },
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const payload = loginSchema.parse(req.body);
  const organization = await OrganizationModel.findOne({ email: payload.email.toLowerCase() });

  if (!organization) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const validPassword = await bcrypt.compare(payload.password, organization.password);
  if (!validPassword) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = signOrganizationToken({
    orgId: String(organization._id),
    email: organization.email,
  });
  setAuthCookie(res, token);

  res.json({
    organization: {
      id: organization._id,
      companyName: organization.companyName,
      email: organization.email,
      plan: organization.plan,
      freeJobUsed: organization.freeJobUsed,
    },
  });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const organization = await OrganizationModel.findById(orgId).select("-password");
  if (!organization) {
    res.status(404).json({ message: "Organization not found" });
    return;
  }

  res.json({ organization });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(getAuthCookieName());
  res.status(204).send();
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function getBackendOrigin(): string {
  return env.BACKEND_PUBLIC_ORIGIN ?? `http://localhost:${env.PORT}`;
}

export function googleAuth(_req: Request, res: Response): void {
  if (!env.GOOGLE_CLIENT_ID) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=google_not_configured`);
    return;
  }
  const redirectUri = `${getBackendOrigin()}/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(302, `${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=google_not_configured`);
    return;
  }
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=missing_code`);
    return;
  }
  const redirectUri = `${getBackendOrigin()}/auth/google/callback`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=token_failed`);
    return;
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=no_token`);
    return;
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=userinfo_failed`);
    return;
  }
  const userData = (await userRes.json()) as {
    id: string;
    email?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
  };
  const googleId = userData.id;
  const email = userData.email?.toLowerCase();
  if (!email) {
    res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=no_email`);
    return;
  }
  const inferredCompanyName =
    [userData.name, userData.given_name, userData.family_name].filter(Boolean).join(" ").trim() ||
    "Organization";

  let organization =
    (await OrganizationModel.findOne({ googleId })) ??
    (await OrganizationModel.findOne({ email }));

  if (!organization) {
    const placeholderPassword = await bcrypt.hash(randomUUID(), 12);
    try {
      organization = await OrganizationModel.create({
        companyName: inferredCompanyName,
        email,
        password: placeholderPassword,
        googleId,
        plan: "free",
        freeJobUsed: false,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        organization =
          (await OrganizationModel.findOne({ googleId })) ??
          (await OrganizationModel.findOne({ email }));
        if (!organization) {
          res.redirect(302, `${env.FRONTEND_ORIGIN}/org/login?error=email_exists`);
          return;
        }
      } else {
        throw error;
      }
    }
  } else {
    if (!organization.googleId) {
      organization.googleId = googleId;
    }
    if (!organization.companyName || organization.companyName === "Organization") {
      organization.companyName = inferredCompanyName;
    }
    await organization.save();
  }

  const token = signOrganizationToken({
    orgId: String(organization._id),
    email: organization.email,
  });
  setAuthCookie(res, token);
  res.redirect(302, `${env.FRONTEND_ORIGIN}/org/dashboard`);
}
