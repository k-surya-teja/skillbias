"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Select, TextInput } from "flowbite-react";
import {
  Briefcase,
  Building2,
  CalendarClock,
  Clock,
  Flame,
  Search,
  ServerCrash,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AppNavbar } from "@/components/navbar";
import { listPublicJobs } from "@/lib/ats/applications";
import type { PublicJob, PublicJobsResponse } from "@/lib/ats/types";

type SortOption = "newest" | "ending-soon";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

function urgencyBadge(days: number) {
  if (days < 0) return null;
  if (days <= 3) {
    return {
      label: days === 0 ? "Closes today" : `${days}d left`,
      cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      icon: Flame,
    };
  }
  if (days <= 7) {
    return {
      label: `${days}d left`,
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      icon: Clock,
    };
  }
  return {
    label: `Closes ${new Date(Date.now() + days * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    icon: CalendarClock,
  };
}

function applyPath(applyLink: string) {
  return applyLink.startsWith("/") ? applyLink : `/${applyLink}`;
}

export default function PublicJobsPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");

  const fetchAbort = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when query changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedSkills, sort]);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      fetchAbort.current?.abort();
      const controller = new AbortController();
      fetchAbort.current = controller;
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const res: PublicJobsResponse = await listPublicJobs({
          q: search || undefined,
          skills: selectedSkills.length ? selectedSkills : undefined,
          sort,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        if (controller.signal.aborted) return;
        setJobs((prev) => (append ? [...prev, ...res.jobs] : res.jobs));
        setTotal(res.total);
        setHasMore(res.hasMore);
        setError("");
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to load jobs";
        if (msg.toLowerCase().includes("fetch") || msg.includes("ECONNREFUSED")) {
          setError("Unable to reach the server. Please try again later.");
        } else {
          setError(msg);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search, selectedSkills, sort],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  const allSkills = useMemo(() => {
    const set = new Set<string>(selectedSkills);
    for (const job of jobs) {
      for (const s of job.requiredSkills) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs, selectedSkills]);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setSelectedSkills([]);
    setSort("newest");
  }

  const hasActiveFilters = !!search || selectedSkills.length > 0 || sort !== "newest";

  function loadMore() {
    const next = page + 1;
    setPage(next);
    void load(next, true);
  }

  return (
    <main className="min-h-screen">
      <AppNavbar />

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Open Positions
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
            Browse open roles from companies hiring on SkillBias. Find the right
            fit and apply directly.
          </p>
        </div>

        {/* Search + Sort row */}
        <div className="mx-auto mb-3 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <TextInput
              icon={Search}
              placeholder="Search by title, company, or skill…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="w-full sm:w-44"
          >
            <option value="newest">Newest first</option>
            <option value="ending-soon">Ending soon</option>
          </Select>
        </div>

        {/* Result summary + clear */}
        <div className="mx-auto mb-3 flex max-w-2xl items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {loading
              ? "Loading…"
              : total === 0
                ? "0 results"
                : `${total} open ${total === 1 ? "role" : "roles"}`}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* Skill filter pills */}
        {allSkills.length > 0 && (
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="flex flex-wrap gap-2">
              {allSkills.map((skill) => {
                const active = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={
                      active
                        ? "inline-flex items-center gap-1 rounded-full border border-indigo-500 bg-indigo-600 px-3 py-1 text-xs font-medium text-white dark:border-indigo-400 dark:bg-indigo-500"
                        : "rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-950"
                    }
                  >
                    {skill}
                    {active && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Initial loading skeleton */}
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="py-20 text-center">
            <ServerCrash className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button
              color="light"
              size="sm"
              className="mx-auto mt-4"
              onClick={() => void load(1, false)}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && jobs.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? "No jobs match your filters" : "No open positions right now"}
          </p>
        )}

        {/* Results grid */}
        {!loading && !error && jobs.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard key={job._id} job={job} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  color="light"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function JobCard({ job }: { job: PublicJob }) {
  const days = daysUntil(job.endDate);
  const urgency = urgencyBadge(days);
  const Urgency = urgency?.icon;
  const postedAgo = daysSince(job.postingDate);
  const isNew = postedAgo !== null && postedAgo <= 3;

  return (
    <Link
      href={applyPath(job.applyLink)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950 dark:hover:border-indigo-700"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 opacity-70"
      />

      <div className="flex flex-1 flex-col p-5">
        {/* Header: company + badges */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {job.companyLogo ? (
              <Image
                src={job.companyLogo}
                alt={job.companyName}
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-fuchsia-100 text-indigo-600 dark:from-indigo-950 dark:to-fuchsia-950 dark:text-indigo-300">
                <Building2 className="h-4 w-4" />
              </span>
            )}
            <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
              {job.companyName || "—"}
            </span>
          </div>
          {isNew && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Sparkles className="h-3 w-3" />
              New
            </span>
          )}
        </div>

        {/* Title + description */}
        <h2 className="text-base font-semibold text-gray-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {job.title}
        </h2>
        <p className="mt-1 line-clamp-3 text-sm text-gray-500 dark:text-gray-400">
          {job.description}
        </p>

        {/* Skills */}
        {job.requiredSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.requiredSkills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
              >
                {skill}
              </span>
            ))}
            {job.requiredSkills.length > 4 && (
              <span className="px-1 text-[11px] text-gray-400">
                +{job.requiredSkills.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Meta footer */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            {urgency && Urgency && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${urgency.cls}`}>
                <Urgency className="h-3 w-3" />
                {urgency.label}
              </span>
            )}
            {job.applicantsCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {job.applicantsCount}
              </span>
            )}
            {postedAgo !== null && postedAgo > 3 && (
              <span>· {postedAgo === 0 ? "today" : `${postedAgo}d ago`}</span>
            )}
          </div>
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors group-hover:border-indigo-500 group-hover:bg-indigo-600 group-hover:text-white dark:border-gray-700 dark:text-gray-200"
          >
            Apply →
          </span>
        </div>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-1.5 h-3 w-5/6 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-4 flex gap-1.5">
        <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-5 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}
