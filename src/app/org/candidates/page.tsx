"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Select, TextInput } from "flowbite-react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Users,
  X,
} from "lucide-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { useAuth } from "@/contexts/AuthContext";
import { listAllCandidates } from "@/lib/ats/applications";
import { getAtsSocket } from "@/lib/ats/socket";
import { getCurrentOrganization } from "@/lib/ats/auth";
import type { CandidateRow, CandidatesResponse } from "@/lib/ats/types";

type StatusFilter = "" | "pending" | "applied" | "shortlisted" | "rejected";
type SortKey = "score" | "createdAt";
type ScoreBucket = "" | "0-40" | "41-60" | "61-80" | "81-100";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  applied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  shortlisted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

function bucketRange(b: ScoreBucket): { min?: number; max?: number } {
  switch (b) {
    case "0-40":
      return { min: 0, max: 40 };
    case "41-60":
      return { min: 41, max: 60 };
    case "61-80":
      return { min: 61, max: 80 };
    case "81-100":
      return { min: 81, max: 100 };
    default:
      return {};
  }
}

function scoreClass(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-gray-700 dark:text-gray-300";
}

function relativeDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CandidatesPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();

  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgId, setOrgId] = useState<string>("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [jobFilter, setJobFilter] = useState<string>("");
  const [scoreBucket, setScoreBucket] = useState<ScoreBucket>("");
  const [sort, setSort] = useState<SortKey>("score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const fetchAbort = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, jobFilter, scoreBucket, sort, order]);

  const load = useCallback(async () => {
    fetchAbort.current?.abort();
    const controller = new AbortController();
    fetchAbort.current = controller;
    setLoading(true);
    try {
      const range = bucketRange(scoreBucket);
      const res = await listAllCandidates({
        q: search || undefined,
        status: statusFilter || undefined,
        jobId: jobFilter || undefined,
        scoreMin: range.min,
        scoreMax: range.max,
        sort,
        order,
        page,
        pageSize: PAGE_SIZE,
      });
      if (controller.signal.aborted) return;
      setData(res);
      setError("");
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load candidates");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [search, statusFilter, jobFilter, scoreBucket, sort, order, page]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    void getCurrentOrganization()
      .then((res) => setOrgId(res.organization.id ?? res.organization._id ?? ""))
      .catch(() => {});
  }, [isLoaded, organization, router]);

  useEffect(() => {
    if (!isLoaded || !organization) return;
    void load();
  }, [isLoaded, organization, load]);

  // Live refresh on new scores
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

  const candidates: CandidateRow[] = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const jobOptions = data?.jobs ?? [];

  const hasActiveFilters =
    !!search || !!statusFilter || !!jobFilter || !!scoreBucket || sort !== "score" || order !== "desc";

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setJobFilter("");
    setScoreBucket("");
    setSort("score");
    setOrder("desc");
  }

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder("desc");
    }
  }

  const summary = useMemo(() => {
    if (!data) return null;
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    if (data.total === 0) return "0 candidates";
    return `${start}–${end} of ${data.total}`;
  }, [data]);

  return (
    <OrgPageShell>
      <div className="min-w-0 space-y-4 px-3 md:px-0">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">
              Candidates
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All applicants across every role you&apos;ve posted.
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
          <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <TextInput
              icon={Search}
              placeholder="Search by email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              aria-label="Filter by job"
            >
              <option value="">All jobs</option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.status === "closed" ? " (closed)" : ""}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="applied">Applied</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select
              value={scoreBucket}
              onChange={(e) => setScoreBucket(e.target.value as ScoreBucket)}
              aria-label="Filter by score"
            >
              <option value="">Any score</option>
              <option value="81-100">81–100 (top)</option>
              <option value="61-80">61–80 (strong)</option>
              <option value="41-60">41–60 (mid)</option>
              <option value="0-40">0–40 (low)</option>
            </Select>
            {hasActiveFilters ? (
              <Button color="light" onClick={clearFilters} size="sm" className="whitespace-nowrap">
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            ) : (
              <span className="hidden md:flex md:items-center md:justify-end md:px-2 md:text-xs md:text-gray-400">
                <Filter className="mr-1 h-3.5 w-3.5" /> filters
              </span>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Summary row */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{loading ? "Loading…" : summary}</span>
          <span>
            sort:{" "}
            <button
              type="button"
              onClick={() => toggleSort("score")}
              className={`hover:underline ${sort === "score" ? "font-semibold text-gray-700 dark:text-gray-200" : ""}`}
            >
              score {sort === "score" ? (order === "asc" ? "↑" : "↓") : ""}
            </button>{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => toggleSort("createdAt")}
              className={`hover:underline ${sort === "createdAt" ? "font-semibold text-gray-700 dark:text-gray-200" : ""}`}
            >
              applied {sort === "createdAt" ? (order === "asc" ? "↑" : "↓") : ""}
            </button>
          </span>
        </div>

        {/* Results table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          {loading && candidates.length === 0 ? (
            <SkeletonRows />
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Users className="h-10 w-10 text-gray-300 dark:text-gray-700" />
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                {hasActiveFilters ? "No candidates match your filters" : "No applicants yet"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? "Try clearing the filters to see all candidates."
                  : "Once someone applies to one of your roles, they'll show up here."}
              </p>
              {hasActiveFilters && (
                <Button color="light" size="sm" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Applied</th>
                    <th className="px-3 py-2 text-right font-medium">Score</th>
                    <th className="px-3 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                    >
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                        {c.email}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        <Link
                          href={`/org/jobs/${c.jobId}`}
                          className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                        >
                          {c.jobTitle || "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                            STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {relativeDate(c.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-semibold ${scoreClass(c.score)}`}>{c.score}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/org/jobs/${c.jobId}`}
                          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && candidates.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  color="light"
                  size="xs"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  color="light"
                  size="xs"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </OrgPageShell>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="ml-auto h-3 w-10 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );
}
