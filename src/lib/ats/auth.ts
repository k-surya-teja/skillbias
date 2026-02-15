import { atsFetch } from "./api";
import { Organization } from "./types";

export async function signupOrganization(payload: {
  companyName: string;
  email: string;
  password: string;
  logo?: string;
}): Promise<{ organization: Organization }> {
  return atsFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginOrganization(payload: {
  email: string;
  password: string;
}): Promise<{ organization: Organization }> {
  return atsFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentOrganization(): Promise<{ organization: Organization }> {
  return atsFetch("/auth/me");
}

export async function syncClerkToAtsSession(
  clerkToken: string,
): Promise<{ organization: Organization }> {
  return atsFetch("/auth/clerk-sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
    body: JSON.stringify({}),
  });
}

export async function logoutOrganization(): Promise<void> {
  await atsFetch("/auth/logout", {
    method: "POST",
    raw: true,
  });
}
