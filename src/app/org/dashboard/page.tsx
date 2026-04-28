"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentOrganization } from "@/lib/ats/auth";
import { getDashboardStats } from "@/lib/ats/analytics";
import { listJobs } from "@/lib/ats/jobs";
import { getAtsSocket } from "@/lib/ats/socket";
import { DashboardStatsResponse, Job } from "@/lib/ats/types";

type Trend = { value: number; positive: boolean } | null;

function relativeFromNow(iso: string): { days: number; label: string } {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return { days, label: `${Math.abs(days)}d ago` };
  if (days === 0) return { days, label: "today" };
  if (days === 1) return { days, label: "tomorrow" };
  return { days, label: `in ${days}d` };
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  shortlisted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export default function OrgDashboardPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // Use allSettled so one slow/failed endpoint doesn't blank the dashboard.
    const [orgResult, statsResult, jobsResult] = await Promise.allSettled([
      getCurrentOrganization(),
      getDashboardStats(),
      listJobs(),
    ]);

    if (orgResult.status === "fulfilled") {
      setOrgId(orgResult.value.organization.id ?? orgResult.value.organization._id ?? "");
    }
    if (statsResult.status === "fulfilled") {
      setData(statsResult.value);
    }
    if (jobsResult.status === "fulfilled") {
      setJobs(jobsResult.value.jobs);
    }

    const failures = [orgResult, statsResult, jobsResult].filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failures.length === 0) {
      setError("");
    } else if (failures.length === 3) {
      setError(
        failures[0].reason instanceof Error
          ? failures[0].reason.message
          : "Failed to load dashboard",
      );
    } else {
      // Partial failure — surface a non-blocking warning but keep what we got.
      setError(
        `Some panels couldn't load (${failures.length}/3). They'll refresh on the next update.`,
      );
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [isLoaded, organization, router, load]);

  useEffect(() => {
    if (!orgId) return;
    const socket = getAtsSocket();
    socket.emit("join_org_room", orgId);
    const listener = () => void load();
    socket.on("candidate_scored", listener);
    return () => {
      socket.off("candidate_scored", listener);
    };
  }, [orgId, load]);

  const weeklyComparison = useMemo<{ thisWeek: number; trend: Trend }>(() => {
    if (!data) return { thisWeek: 0, trend: null };
    const series = data.charts.applicationsOverTime;
    if (series.length === 0) return { thisWeek: 0, trend: null };
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 86400000);
    let thisWeek = 0;
    let lastWeek = 0;
    for (const point of series) {
      const d = new Date(point.date);
      if (d >= sevenDaysAgo) thisWeek += point.count;
      else if (d >= fourteenDaysAgo) lastWeek += point.count;
    }
    if (lastWeek === 0) {
      return { thisWeek, trend: thisWeek > 0 ? { value: 100, positive: true } : null };
    }
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    return { thisWeek, trend: { value: Math.abs(pct), positive: pct >= 0 } };
  }, [data]);

  const conversionRate = useMemo(() => {
    if (!data) return 0;
    const { shortlisted, pending, applied, rejected } = data.pipelineByStatus;
    const total = shortlisted + pending + applied + rejected;
    if (total === 0) return 0;
    return Math.round((shortlisted / total) * 100);
  }, [data]);

  const highQualityCount = useMemo(() => {
    if (!data) return 0;
    return data.charts.scoreDistribution
      .filter((b) => b.range === "61-80" || b.range === "81-100")
      .reduce((s, b) => s + b.count, 0);
  }, [data]);

  const expiringSoon = useMemo(() => {
    return jobs
      .filter((j) => j.status === "active")
      .map((j) => ({ ...j, ...relativeFromNow(j.endDate) }))
      .filter((j) => j.days <= 7 && j.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [jobs]);

  const zeroApplicantJobs = useMemo(() => {
    if (!data) return [];
    const titles = new Set(
      data.charts.applicantsPerJob.filter((j) => j.count === 0).map((j) => j.jobTitle),
    );
    return jobs.filter((j) => j.status === "active" && titles.has(j.title)).slice(0, 4);
  }, [jobs, data]);

  const reviewQueue = useMemo(() => {
    if (!data) return [];
    return data.topCandidates.filter((c) => c.status === "pending" || c.status === "applied").slice(0, 4);
  }, [data]);

  const pipelineRows = useMemo(() => {
    if (!data) return [];
    const total = Math.max(
      1,
      data.pipelineByStatus.pending +
        data.pipelineByStatus.applied +
        data.pipelineByStatus.shortlisted +
        data.pipelineByStatus.rejected,
    );
    return [
      { key: "pending", label: "Pending", count: data.pipelineByStatus.pending, color: "bg-amber-500" },
      { key: "applied", label: "Applied", count: data.pipelineByStatus.applied, color: "bg-blue-500" },
      { key: "shortlisted", label: "Shortlisted", count: data.pipelineByStatus.shortlisted, color: "bg-emerald-500" },
      { key: "rejected", label: "Rejected", count: data.pipelineByStatus.rejected, color: "bg-rose-500" },
    ].map((row) => ({ ...row, pct: Math.round((row.count / total) * 100) }));
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Active jobs",
        value: data.stats.activeJobs,
        sub: `${data.stats.closedJobs} closed`,
        icon: Briefcase,
        accent: "text-indigo-600 dark:text-indigo-400",
      },
      {
        label: "Applicants",
        value: data.stats.totalApplicants,
        sub: `${weeklyComparison.thisWeek} this week`,
        trend: weeklyComparison.trend,
        icon: Users,
        accent: "text-blue-600 dark:text-blue-400",
      },
      {
        label: "New this week",
        value: weeklyComparison.thisWeek,
        sub: weeklyComparison.trend
          ? `${weeklyComparison.trend.positive ? "+" : "-"}${weeklyComparison.trend.value}% vs last`
          : "No prior data",
        icon: UserPlus,
        accent: "text-cyan-600 dark:text-cyan-400",
      },
      {
        label: "Avg score",
        value: data.stats.avgScore,
        sub: `${highQualityCount} above 60`,
        icon: Sparkles,
        accent: "text-amber-600 dark:text-amber-400",
      },
      {
        label: "Shortlist rate",
        value: `${conversionRate}%`,
        sub: `${data.pipelineByStatus.shortlisted} shortlisted`,
        icon: TrendingUp,
        accent: "text-emerald-600 dark:text-emerald-400",
      },
      {
        label: "Top score",
        value: data.stats.topCandidate?.score ?? "—",
        sub: data.stats.topCandidate?.email ?? "No applicants yet",
        icon: CheckCircle2,
        accent: "text-fuchsia-600 dark:text-fuchsia-400",
      },
    ];
  }, [data, weeklyComparison, highQualityCount, conversionRate]);

  return (
    <OrgPageShell>
      <div className="min-w-0 space-y-4 px-3 md:px-0">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {organization?.companyName ? `${organization.companyName} · ` : ""}
              {data ? `${data.stats.activeJobs} active roles · ${data.stats.totalApplicants} applicants` : "Loading insights…"}
            </p>
          </div>
          <Link
            href="/org/jobs/create"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Briefcase className="h-4 w-4" /> New job
          </Link>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {kpi.label}
                  </span>
                  <Icon className={`h-3.5 w-3.5 ${kpi.accent}`} />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-semibold text-gray-900 dark:text-white">
                    {kpi.value}
                  </span>
                  {kpi.trend && (
                    <span
                      className={`inline-flex items-center text-[11px] font-medium ${
                        kpi.trend.positive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {kpi.trend.positive ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {kpi.trend.value}%
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400" title={String(kpi.sub)}>
                  {kpi.sub}
                </p>
              </div>
            );
          })}
        </div>

        {/* Actionable row: Needs Attention + Top Candidates */}
        {data && (
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 lg:col-span-2">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-fuchsia-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Top candidates
                </h2>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  ranked by score
                </span>
              </div>
              {data.topCandidates.length === 0 ? (
                <EmptyRow text="No applicants yet — share your apply link to start receiving candidates." />
              ) : (
                <div className="overflow-hidden rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">#</th>
                        <th className="px-2 py-1.5 font-medium">Candidate</th>
                        <th className="px-2 py-1.5 font-medium">Role</th>
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topCandidates.map((c, idx) => (
                        <tr
                          key={c.id}
                          className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                        >
                          <td className="px-2 py-1.5 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white">
                            <Link href={`/org/jobs/${c.jobId}`} className="hover:underline">
                              {c.email}
                            </Link>
                          </td>
                          <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">
                            {c.jobTitle || "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                                STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <span
                              className={`font-semibold ${
                                c.score >= 80
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : c.score >= 60
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {c.score}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
              <div className="mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Needs attention
                </h2>
              </div>
              <div className="space-y-3">
                <AttentionGroup
                  icon={<CalendarClock className="h-3.5 w-3.5 text-amber-500" />}
                  label="Closing soon"
                  empty="No jobs closing this week"
                  items={expiringSoon.map((j) => ({
                    id: j._id,
                    title: j.title,
                    meta: j.label,
                    href: `/org/jobs/${j._id}`,
                  }))}
                />
                <AttentionGroup
                  icon={<UserPlus className="h-3.5 w-3.5 text-rose-500" />}
                  label="No applicants yet"
                  empty="Every job has applicants"
                  items={zeroApplicantJobs.map((j) => ({
                    id: j._id,
                    title: j.title,
                    meta: "0 applicants",
                    href: `/org/jobs/${j._id}`,
                  }))}
                />
                <AttentionGroup
                  icon={<Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                  label="High scorers awaiting review"
                  empty="Review queue is clear"
                  items={reviewQueue.map((c) => ({
                    id: c.id,
                    title: c.email,
                    meta: `${c.score} · ${c.jobTitle}`,
                    href: `/org/jobs/${c.jobId}`,
                  }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Pipeline funnel */}
        {data && (
          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pipeline</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.stats.totalApplicants} candidates total
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {pipelineRows.map((row) => (
                <div key={row.key} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {row.count} <span className="font-normal text-gray-500">({row.pct}%)</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div className={`h-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Charts */}
        {data && (
          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard title="Applicants per job" colSpan="lg:col-span-2">
              {data.charts.applicantsPerJob.some((i) => i.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.applicantsPerJob}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="jobTitle" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="No applicant data yet" />
              )}
            </ChartCard>

            <ChartCard title="Applications over time">
              {data.charts.applicationsOverTime.some((i) => i.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.charts.applicationsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line dataKey="count" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty text="No timeline yet" />
              )}
            </ChartCard>
          </div>
        )}
      </div>
    </OrgPageShell>
  );
}

function AttentionGroup({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  empty: string;
  items: Array<{ id: string; title: string; meta: string; href: string }>;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200">
        {icon}
        {label}
        <span className="ml-auto text-[10px] text-gray-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <span className="truncate font-medium text-gray-900 dark:text-white">{item.title}</span>
                <span className="ml-2 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                  {item.meta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
  colSpan,
}: {
  title: string;
  children: React.ReactNode;
  colSpan?: string;
}) {
  return (
    <div
      className={`h-56 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 ${colSpan ?? ""}`}
    >
      <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      <div className="h-[calc(100%-1.5rem)]">{children}</div>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
      {text}
    </p>
  );
}
