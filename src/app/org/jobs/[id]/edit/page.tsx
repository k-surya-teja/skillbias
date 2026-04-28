"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import { Button } from "flowbite-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { JobForm, JobFormPayload } from "@/components/org/JobForm";
import { useToast } from "@/contexts/ToastContext";
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

  const toast = useToast();

  async function handleUpdate(payload: JobFormPayload) {
    await updateJob(jobId, payload);
    toast.success("Job updated successfully");
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
      <Link href="/org/jobs">
        <Button size="xs" className="mb-3" color="light">
          <ArrowLeft className="mr-1 h-4 w-4" />Go Back
        </Button>
      </Link>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Edit Job
      </h1>
      <JobForm initialData={job} onSubmit={handleUpdate} submitLabel="Update" />
    </OrgPageShell>
  );
}
