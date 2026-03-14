"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function OrgEntryPage() {
  const router = useRouter();
  const { organization, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    router.replace("/org/dashboard");
  }, [isLoaded, organization, router]);

  return (
    <main className="min-h-screen">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 px-6 py-5 text-center shadow-2xl">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-indigo-300/40 border-t-indigo-400" />
          <p className="text-sm font-medium text-slate-100">Redirecting</p>
        </div>
      </div>
    </main>
  );
}
