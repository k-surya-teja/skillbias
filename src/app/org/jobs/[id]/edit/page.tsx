"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { JobForm, JobFormPayload } from "@/components/org/JobForm";
import { getJob, updateJob } from "@/lib/ats/jobs";
import { Job } from "@/lib/ats/types";

export default function EditJobPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");

  const loadJob = useCallback(async () => {
    try {
      const res = await getJob(jobId);
      setJob(res.job);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load job");
    }
  }, [jobId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    const timer = setTimeout(() => void loadJob(), 0);
    return () => clearTimeout(timer);
  }, [isLoaded, organization, router, loadJob]);

  async function handleUpdate(payload: JobFormPayload) {
    await updateJob(jobId, payload);
    router.push("/org/jobs");
  }

  if (error) {
    return (
      <OrgPageShell>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </OrgPageShell>
    );
  }

  if (!job) {
    return (
      <OrgPageShell>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </OrgPageShell>
    );
  }

  return (
    <OrgPageShell>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
        Edit Job
      </h1>
      <JobForm initialData={job} onSubmit={handleUpdate} submitLabel="Update" />
    </OrgPageShell>
  );
}
