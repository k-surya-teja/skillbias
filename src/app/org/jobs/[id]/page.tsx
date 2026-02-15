"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Button, Select, TextInput } from "flowbite-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { getJob, getJobApplications, getJobExportUrl } from "@/lib/ats/jobs";
import { updateApplication } from "@/lib/ats/applications";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";
import { Application, Job } from "@/lib/ats/types";

export default function JobDetailPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      await ensureAtsSessionFromClerk(getToken);
      const [jobRes, appRes] = await Promise.all([
        getJob(jobId),
        getJobApplications(jobId, { sortBy: "score", order: "desc", status: statusFilter || undefined }),
      ]);
      setJob(jobRes.job);
      setApplications(appRes.applications);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job details");
    }
  }, [getToken, jobId, statusFilter]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, load]);

  const rankedApplications = useMemo(
    () => [...applications].sort((a, b) => b.score - a.score),
    [applications],
  );

  async function patchApplication(id: string, patch: { status?: Application["status"]; notes?: string }) {
    try {
      await updateApplication(id, patch);
      await load();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Failed to update application");
    }
  }

  return (
    <OrgPageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
          {job?.title ?? "Job Details"}
        </h1>
        <a href={getJobExportUrl(jobId)} target="_blank" rel="noreferrer">
          <Button color="light">Export CSV</Button>
        </a>
      </div>

      <div className="mb-4 max-w-xs">
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="applied">applied</option>
          <option value="shortlisted">shortlisted</option>
          <option value="rejected">rejected</option>
        </Select>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-3 py-3">Rank</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Score</th>
                <th className="px-3 py-3">Resume</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rankedApplications.map((application, index) => (
                <tr key={application._id} className="border-t border-gray-200 dark:border-gray-800">
                  <td className="px-3 py-3">{index + 1}</td>
                  <td className="px-3 py-3">{application.email}</td>
                  <td className="px-3 py-3 font-semibold">{application.score}</td>
                  <td className="px-3 py-3">
                    <a
                      className="text-indigo-600 underline dark:text-indigo-400"
                      href={`${process.env.NEXT_PUBLIC_ATS_API_BASE_URL ?? "http://localhost:4000"}${application.resumeUrl}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <Select
                      value={application.status}
                      onChange={(event) =>
                        patchApplication(application._id, {
                          status: event.target.value as Application["status"],
                        })
                      }
                    >
                      <option value="pending">pending</option>
                      <option value="applied">applied</option>
                      <option value="shortlisted">shortlisted</option>
                      <option value="rejected">rejected</option>
                    </Select>
                  </td>
                  <td className="px-3 py-3">
                    <TextInput
                      defaultValue={application.notes ?? ""}
                      placeholder="Add notes"
                      onBlur={(event) =>
                        patchApplication(application._id, {
                          notes: event.target.value,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
              {rankedApplications.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-600 dark:text-gray-300">
                    No applications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OrgPageShell>
  );
}
