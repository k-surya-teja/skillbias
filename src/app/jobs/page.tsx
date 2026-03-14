"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Select, TextInput } from "flowbite-react";
import {
  Briefcase,
  Building2,
  Calendar,
  Search,
  ServerCrash,
  X,
} from "lucide-react";
import { AppNavbar } from "@/components/navbar";
import { listPublicJobs } from "@/lib/ats/applications";
import type { PublicJob } from "@/lib/ats/types";

type SortOption = "newest" | "ending-soon";

export default function PublicJobsPage() {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("newest");

  useEffect(() => {
    listPublicJobs()
      .then((res) => setJobs(res.jobs))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load jobs";
        if (msg.toLowerCase().includes("fetch") || msg.includes("ECONNREFUSED")) {
          setError("Unable to reach the server. Please try again later.");
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const allSkills = useMemo(() => {
    const set = new Set<string>();
    for (const job of jobs) {
      for (const s of job.requiredSkills) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  const filtered = useMemo(() => {
    let result = jobs;

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (job) =>
          job.title.toLowerCase().includes(q) ||
          job.companyName.toLowerCase().includes(q) ||
          job.requiredSkills.some((s) => s.toLowerCase().includes(q)),
      );
    }

    if (selectedSkills.length > 0) {
      result = result.filter((job) =>
        selectedSkills.every((sk) =>
          job.requiredSkills.some((js) => js.toLowerCase() === sk.toLowerCase()),
        ),
      );
    }

    const sorted = [...result];
    if (sort === "ending-soon") {
      sorted.sort(
        (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime(),
      );
    }

    return sorted;
  }, [jobs, search, selectedSkills, sort]);

  function applyPath(applyLink: string) {
    return applyLink.startsWith("/") ? applyLink : `/${applyLink}`;
  }

  return (
    <main className="min-h-screen">
      <AppNavbar />

      <section className="mx-auto max-w-5xl px-4 py-10">
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
        <div className="mx-auto mb-4 flex max-w-2xl flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <TextInput
              icon={Search}
              placeholder="Search by title, company, or skill..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {loading && (
          <p className="py-20 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading jobs...
          </p>
        )}

        {error && (
          <div className="py-20 text-center">
            <ServerCrash className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-20 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {search || selectedSkills.length > 0
                ? "No jobs match your filters."
                : "No public jobs available right now."}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <div
              key={job._id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-lg dark:border-gray-800 dark:bg-gray-950"
            >
              <div>
                <div className="mb-3 flex items-center gap-3">
                  {job.companyLogo ? (
                    <Image
                      src={job.companyLogo}
                      alt={job.companyName}
                      width={36}
                      height={36}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                      <Building2 className="h-4 w-4" />
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {job.companyName}
                  </span>
                </div>

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {job.title}
                </h2>

                <p className="mt-1 line-clamp-3 text-sm text-gray-500 dark:text-gray-400">
                  {job.description}
                </p>

                {job.requiredSkills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.requiredSkills.slice(0, 5).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"
                      >
                        {skill}
                      </span>
                    ))}
                    {job.requiredSkills.length > 5 && (
                      <span className="text-xs text-gray-400">
                        +{job.requiredSkills.length - 5} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(job.endDate).toLocaleDateString()}
                </span>
                <Link href={applyPath(job.applyLink)}>
                  <Button size="xs">Apply</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
