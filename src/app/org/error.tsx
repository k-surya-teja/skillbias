"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function OrgSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OrgError]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          This page failed to load
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          You can retry, or jump to another section from the sidebar.
        </p>
        {process.env.NODE_ENV !== "production" && error?.message && (
          <pre className="mt-3 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-left text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {error.message}
          </pre>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <Link
            href="/org/dashboard"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
