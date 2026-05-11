import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DESCRIPTION_SNIPPET_LENGTH = 220;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

function snippet(text: string): string {
  if (!text) return "";
  if (text.length <= DESCRIPTION_SNIPPET_LENGTH) return text;
  return text.slice(0, DESCRIPTION_SNIPPET_LENGTH).trimEnd() + "…";
}

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);

  const q = (url.searchParams.get("q") ?? "").trim();
  const skillsParam = url.searchParams.get("skills") ?? "";
  const skills = skillsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sort = url.searchParams.get("sort") === "ending-soon" ? "ending-soon" : "newest";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE),
  );

  let query = supabase
    .from("jobs")
    .select(
      "id, title, description, required_skills, end_date, posting_date, created_at, apply_link, org_id",
      { count: "exact" },
    )
    .eq("is_public", true)
    .eq("status", "active");

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%`,
    );
  }
  if (skills.length > 0) {
    query = query.contains("required_skills", skills);
  }

  query =
    sort === "ending-soon"
      ? query.order("end_date", { ascending: true })
      : query.order("created_at", { ascending: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: jobs, count, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const orgIds = Array.from(new Set((jobs ?? []).map((j) => j.org_id)));
  const jobIds = (jobs ?? []).map((j) => j.id);

  const [orgsRes, countsRes] = await Promise.all([
    orgIds.length > 0
      ? supabase
          .from("organizations")
          .select("user_id, company_name, logo")
          .in("user_id", orgIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length > 0
      ? supabase
          .from("applications")
          .select("job_id")
          .in("job_id", jobIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const orgByUserId = new Map(
    (orgsRes.data ?? []).map((o) => [o.user_id, o] as const),
  );
  const countByJob = new Map<string, number>();
  for (const row of countsRes.data ?? []) {
    countByJob.set(row.job_id, (countByJob.get(row.job_id) ?? 0) + 1);
  }

  let mapped = (jobs ?? []).map((job) => {
    const org = orgByUserId.get(job.org_id);
    return {
      _id: job.id,
      title: job.title,
      description: snippet(job.description ?? ""),
      requiredSkills: job.required_skills,
      endDate: job.end_date,
      postingDate: job.created_at ?? job.posting_date,
      applyLink: job.apply_link,
      companyName: org?.company_name ?? "",
      companyLogo: org?.logo ?? "",
      applicantsCount: countByJob.get(job.id) ?? 0,
    };
  });

  // Post-filter on company name (matches Express behavior — cheap, current page only).
  if (q) {
    const lc = q.toLowerCase();
    const titleMatches = new Set(mapped.filter((j) => j.title.toLowerCase().includes(lc)).map((j) => j._id));
    const descMatches = new Set(mapped.filter((j) => j.description.toLowerCase().includes(lc)).map((j) => j._id));
    const companyMatches = new Set(
      mapped.filter((j) => j.companyName.toLowerCase().includes(lc)).map((j) => j._id),
    );
    const keep = new Set([...titleMatches, ...descMatches, ...companyMatches]);
    mapped = mapped.filter((j) => keep.has(j._id));
  }

  const total = count ?? 0;
  return NextResponse.json({
    jobs: mapped,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  });
}
