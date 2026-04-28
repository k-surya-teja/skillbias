"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "flowbite-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { JobForm, JobFormPayload } from "@/components/org/JobForm";
import { useToast } from "@/contexts/ToastContext";
import { createJob } from "@/lib/ats";

export default function CreateJobPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();
  const [freeJobAlert, setFreeJobAlert] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    if (organization.plan === "free" && organization.freeJobUsed === false) {
      setFreeJobAlert("Free plan includes 1 job post. This will use your free job credit.");
    }
  }, [isLoaded, organization, router]);

  const toast = useToast();

  async function handleCreate(payload: JobFormPayload) {
    await createJob(payload);
    toast.success("Job created successfully");
    router.push("/org/jobs");
  }

  return (
    <OrgPageShell>
      <Link href="/org/jobs">
        <Button size="xs" className="mb-3" color="light">
          <ArrowLeft className="mr-1 h-4 w-4" />Go Back
        </Button>
      </Link>
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Create Job
      </h1>

      {freeJobAlert && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <span>{freeJobAlert}</span>
          <Link
            href="/org/billing"
            className="rounded-md border border-amber-400 bg-white/50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
          >
            Upgrade to Pro
          </Link>
        </div>
      )}

      <JobForm onSubmit={handleCreate} submitLabel="Create" />
    </OrgPageShell>
  );
}
