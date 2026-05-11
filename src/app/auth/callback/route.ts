import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles the redirect leg of:
//   - Google OAuth (signInWithOAuth)
//   - Email confirmation links from signUp
// Both arrive here with ?code=<one-time code>; we exchange it for a session
// (which sets the auth cookies) and bounce the user to ?next= or the dashboard.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/org/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/org/login?error=oauth_failed", url.origin));
}
