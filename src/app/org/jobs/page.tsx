"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { deleteJob, listJobs } from "@/lib/ats";
import { CircleAlert, Plus } from "lucide-react";
import { Job } from "@/lib/ats/types";

export default function OrgJobsPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const response = await listJobs();
      setJobs(response.jobs);
      setError("");
    } catch (jobsError) {
      setError(jobsError instanceof Error ? jobsError.message : "Failed to load jobs");
    }
  }, []);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJob(deleteTarget._id);
      setDeleteTarget(null);
      await loadJobs();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete job");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    const timer = setTimeout(() => void loadJobs(), 0);
    return () => clearTimeout(timer);
  }, [isLoaded, organization, router, loadJobs]);

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
                      <Link href={`/org/jobs/${job._id}/edit`}>
                        <Button color="light" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button color="failure" size="sm" onClick={() => setDeleteTarget(job)}>
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

      <Modal show={deleteTarget !== null} size="md" onClose={() => setDeleteTarget(null)} popup>
        <ModalHeader />
        <ModalBody>
          <div className="text-center">
            <CircleAlert className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{deleteTarget?.title}</span>?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="failure" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, delete"}
              </Button>
              <Button color="gray" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </OrgPageShell>
  );
}
