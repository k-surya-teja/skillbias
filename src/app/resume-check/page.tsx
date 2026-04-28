import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { ResumeAnalysisForm } from "@/components/forms";
import { AppNavbar } from "@/components/navbar";

export default function ResumeCheckPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950/40">
      <AppNavbar />
      <section className="mx-auto w-full max-w-5xl px-4 py-6 md:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
        </Link>
        <div className="mt-4">
          <ResumeAnalysisForm />
        </div>
      </section>
    </main>
  );
}
