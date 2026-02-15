import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { createClerkClient, verifyToken } from "@clerk/backend";
import { z } from "zod";
import { env } from "../config/env.js";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";
import { getAuthCookieName, signOrganizationToken } from "../utils/jwt.js";

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

const clerkClient = env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
  : null;

export async function signup(req: Request, res: Response): Promise<void> {
  const payload = signupSchema.parse(req.body);

  const existing = await OrganizationModel.findOne({ email: payload.email.toLowerCase() });
  if (existing) {
    res.status(409).json({ message: "Organization email already exists" });
    return;
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);
  const organization = await OrganizationModel.create({
    companyName: payload.companyName,
    email: payload.email.toLowerCase(),
    password: hashedPassword,
    logo: payload.logo ?? "",
    plan: "free",
    freeJobUsed: false,
  });

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

export async function clerkSync(req: Request, res: Response): Promise<void> {
  if (!env.CLERK_SECRET_KEY || !clerkClient) {
    res.status(503).json({ message: "Clerk is not configured on backend" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token" });
    return;
  }

  const clerkToken = authHeader.slice("Bearer ".length);
  const payload = await verifyToken(clerkToken, { secretKey: env.CLERK_SECRET_KEY });
  const clerkUserId = payload.sub;

  if (!clerkUserId) {
    res.status(401).json({ message: "Invalid Clerk token payload" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );

  if (!primaryEmail?.emailAddress) {
    res.status(400).json({ message: "No primary email found on Clerk user" });
    return;
  }

  const normalizedEmail = primaryEmail.emailAddress.toLowerCase();
  const inferredCompanyName =
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "Organization";

  let organization =
    (await OrganizationModel.findOne({ clerkUserId })) ??
    (await OrganizationModel.findOne({ email: normalizedEmail }));

  if (!organization) {
    const placeholderPassword = await bcrypt.hash(randomUUID(), 12);
    organization = await OrganizationModel.create({
      companyName: inferredCompanyName,
      email: normalizedEmail,
      password: placeholderPassword,
      clerkUserId,
      plan: "free",
      freeJobUsed: false,
    });
  } else {
    if (!organization.clerkUserId) {
      organization.clerkUserId = clerkUserId;
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
