import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "email,score,status,notes,resumeUrl,createdAt\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // RLS ensures the caller only sees applications belonging to a job they own.
  const { data, error } = await supabase
    .from("applications")
    .select("email, score, status, notes, resume_url, created_at")
    .eq("job_id", id)
    .order("score", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const csv = toCsv(
    (data ?? []).map((a) => ({
      email: a.email,
      score: a.score,
      status: a.status,
      notes: a.notes,
      resumeUrl: a.resume_url
        ? `/api/resumes/download?path=${encodeURIComponent(a.resume_url)}`
        : "",
      createdAt: a.created_at,
    })),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="job-${id}-applications.csv"`,
    },
  });
}
