"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "flowbite-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { deleteJob, listJobs } from "@/lib/ats";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";
import { Plus } from "lucide-react";
import { Job } from "@/lib/ats/types";

export default function OrgJobsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    try {
      await ensureAtsSessionFromClerk(getToken);
      const response = await listJobs();
      setJobs(response.jobs);
      setError("");
    } catch (jobsError) {
      setError(jobsError instanceof Error ? jobsError.message : "Failed to load jobs");
    }
  }, [getToken]);

  async function onDelete(jobId: string) {
    try {
      await deleteJob(jobId);
      await loadJobs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete job");
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    const timer = setTimeout(() => {
      void loadJobs();
    }, 0);
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, loadJobs]);

  return (
    <OrgPageShell>
      <div className="min-w-0 px-3 md:px-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Jobs
          </h1>
          <Link href="/org/jobs/create">
            <Button><Plus className="mr-1" />Create New</Button>
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Apply Link</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job._id} className="border-t border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{job.title}</td>
                  <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-200">{job.status}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{job.applyLink}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/org/jobs/${job._id}`}>
                        <Button color="light" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button color="failure" size="sm" onClick={() => onDelete(job._id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {jobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-600 dark:text-gray-300">
                    No jobs yet. Click &quot;Create New&quot; to post your first role.
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
