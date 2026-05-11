import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OrganizationRow } from "@/lib/supabase/types";
import { dbOrgToOrganization } from "./orgMapper";
import type { Organization } from "./types";

async function loadOrgRow(userId: string): Promise<OrganizationRow> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) {
    throw new Error("Profile lookup failed. Try refreshing the page.");
  }
  return data as OrganizationRow;
}

export async function signupOrganization(payload: {
  companyName: string;
  email: string;
  password: string;
  logo?: string;
}): Promise<{ organization: Organization }> {
  const supabase = createSupabaseBrowserClient();
  const emailRedirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: payload.email.trim(),
    password: payload.password,
    options: {
      data: { company_name: payload.companyName.trim() },
      emailRedirectTo,
    },
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Signup did not return a user.");

  // If email confirmation is enabled, session is null — user must click the
  // link before they can sign in. The handle_new_user trigger has already
  // created the org row, so a subsequent login will find it.
  if (!data.session) {
    throw new Error(
      "Account created. Check your email to confirm your address, then sign in.",
    );
  }

  const row = await loadOrgRow(data.user.id);
  return { organization: dbOrgToOrganization(row, data.user.email ?? payload.email) };
}

export async function loginOrganization(payload: {
  email: string;
  password: string;
}): Promise<{ organization: Organization }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email.trim(),
    password: payload.password,
  });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Login did not return a user.");

  const row = await loadOrgRow(data.user.id);
  return { organization: dbOrgToOrganization(row, data.user.email ?? payload.email) };
}

export async function getCurrentOrganization(): Promise<{ organization: Organization }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const row = await loadOrgRow(user.id);
  return { organization: dbOrgToOrganization(row, user.email ?? "") };
}

export async function logoutOrganization(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.signOut();
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "/auth/callback";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}
