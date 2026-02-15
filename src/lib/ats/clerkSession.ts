"use client";

import { syncClerkToAtsSession } from "./auth";
import { Organization } from "./types";

export async function ensureAtsSessionFromClerk(
  getToken: () => Promise<string | null>,
): Promise<Organization> {
  const token = await getToken();
  if (!token) {
    throw new Error("Missing Clerk session token");
  }

  const response = await syncClerkToAtsSession(token);
  return response.organization;
}
