import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes — long enough for a single download

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const storagePath = url.searchParams.get("path");
  if (!storagePath) {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }

  // Ownership check: the storage path must belong to one of this org's applications.
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("resume_url", storagePath)
    .maybeSingle();
  if (!app) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // Mint a short-lived signed URL with the admin client and redirect.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("resumes")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { message: error?.message ?? "Could not generate download link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
