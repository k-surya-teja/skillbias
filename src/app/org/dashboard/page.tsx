"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { BarChart3 } from "lucide-react";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { getCurrentOrganization } from "@/lib/ats/auth";
import { getDashboardStats } from "@/lib/ats/analytics";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";
import { getAtsSocket } from "@/lib/ats/socket";
import { DashboardStatsResponse } from "@/lib/ats/types";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#ef4444"];

export default function OrgDashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      await ensureAtsSessionFromClerk(getToken);
      const [orgRes, statsRes] = await Promise.all([getCurrentOrganization(), getDashboardStats()]);
      setOrgId(orgRes.organization.id ?? orgRes.organization._id ?? "");
      setData(statsRes);
      setError("");
    } catch (dashboardError) {
      setError(dashboardError instanceof Error ? dashboardError.message : "Failed to load dashboard");
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    if (!orgId) {
      return;
    }
    const socket = getAtsSocket();
    socket.emit("join_org_room", orgId);
    const listener = () => void load();
    socket.on("candidate_scored", listener);
    return () => {
      socket.off("candidate_scored", listener);
    };
  }, [orgId, load]);

  const statsCards = useMemo(() => {
    if (!data) return [];
    return [
      { title: "Total Jobs", value: data.stats.totalJobs },
      { title: "Total Applicants", value: data.stats.totalApplicants },
      { title: "Average Score", value: data.stats.avgScore },
      {
        title: "Top Candidate",
        value: data.stats.topCandidate
          ? `${data.stats.topCandidate.email} (${data.stats.topCandidate.score})`
          : "N/A",
        spanFull: true,
      },
    ];
  }, [data]);

  const hasApplicantsPerJobData =
    Boolean(data?.charts.applicantsPerJob.length) &&
    data!.charts.applicantsPerJob.some((item) => item.count > 0);
  const hasScoreDistributionData =
    Boolean(data?.charts.scoreDistribution.length) &&
    data!.charts.scoreDistribution.some((item) => item.count > 0);
  const hasApplicationsOverTimeData =
    Boolean(data?.charts.applicationsOverTime.length) &&
    data!.charts.applicationsOverTime.some((item) => item.count > 0);

  return (
    <OrgPageShell>
      <div className="min-w-0 space-y-4 px-3 md:space-y-6 md:px-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
          Hiring Dashboard
        </h1>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {statsCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950 md:p-4 ${
                card.spanFull ? "col-span-2 xl:col-span-1" : ""
              }`}
            >
              <p className="text-sm text-gray-600 dark:text-gray-300">{card.title}</p>
              <p className="mt-2 break-words text-2xl font-semibold text-gray-900 dark:text-white">
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {data && (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-64 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:h-72">
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Applicants per job</p>
              {hasApplicantsPerJobData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.applicantsPerJob}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jobTitle" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[calc(100%-28px)] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 text-center dark:border-gray-700">
                  <BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No applicant data yet
                  </p>
                </div>
              )}
            </div>

            <div className="h-64 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:h-72">
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Score distribution</p>
              {hasScoreDistributionData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.charts.scoreDistribution} dataKey="count" nameKey="range" outerRadius={90}>
                      {data.charts.scoreDistribution.map((entry, index) => (
                        <Cell key={entry.range} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[calc(100%-28px)] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 text-center dark:border-gray-700">
                  <BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No score data yet
                  </p>
                </div>
              )}
            </div>

            <div className="h-64 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:h-72 xl:col-span-2">
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">Applications over time</p>
              {hasApplicationsOverTimeData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.charts.applicationsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="count" stroke="#22c55e" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[calc(100%-28px)] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 text-center dark:border-gray-700">
                  <BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    No timeline data yet
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </OrgPageShell>
  );
}
