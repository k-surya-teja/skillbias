"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { JobForm, JobFormPayload } from "@/components/org/JobForm";
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

  async function handleCreate(payload: JobFormPayload) {
    await createJob(payload);
    router.push("/org/jobs");
  }

  return (
    <OrgPageShell>
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
        Create Job
      </h1>

      {freeJobAlert && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {freeJobAlert}
        </div>
      )}

      <JobForm onSubmit={handleCreate} submitLabel="Create" />
    </OrgPageShell>
  );
}
