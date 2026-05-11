import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scoreWithProvider } from "@/lib/scoring/aiProviders";
import { SAMPLE_TEST_INPUT, type AiProvider, type AiScoringConfig } from "@/lib/scoring/types";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let payload: {
    provider?: AiProvider;
    model?: string;
    apiKey?: string;
    customUrl?: string;
    customAuthHeader?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const provider = payload.provider;
  if (!provider) {
    return NextResponse.json({ message: "provider is required" }, { status: 400 });
  }

  // When the caller omits secrets (because the form was left blank to keep the
  // existing value), pull the saved ones from the DB. Admin client because the
  // ai_api_key column isn't readable through anything else.
  let apiKey = payload.apiKey ?? "";
  let customAuthHeader = payload.customAuthHeader ?? "";
  if (!apiKey || !customAuthHeader) {
    const admin = createSupabaseAdminClient();
    const { data: org } = await admin
      .from("organizations")
      .select("ai_api_key, ai_custom_auth_header")
      .eq("user_id", user.id)
      .single();
    if (!apiKey) apiKey = org?.ai_api_key ?? "";
    if (!customAuthHeader) customAuthHeader = org?.ai_custom_auth_header ?? "";
  }

  const config: AiScoringConfig = {
    provider,
    model: payload.model ?? "",
    apiKey,
    customUrl: payload.customUrl ?? "",
    customAuthHeader,
  };

  const start = Date.now();
  try {
    const result = await scoreWithProvider(config, SAMPLE_TEST_INPUT);
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - start,
      sampleScore: result.score,
      sampleFeedback: result.feedback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider call failed";
    return NextResponse.json(
      { message, details: { provider, error: message } },
      { status: 502 },
    );
  }
}
