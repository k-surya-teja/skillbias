import { ResumeAnalysisForm } from "@/components/forms";
import { AppNavbar } from "@/components/navbar";
import Link from "next/link";
import { Button } from "flowbite-react";
import { ArrowLeftIcon } from "lucide-react";

export default function ResumeCheckPage() {
  return (
    <main className="min-h-screen">
      <AppNavbar />
      <section className="mx-0 w-auto py-10 md:mx-[10%]">
          <Link href="/">
            <Button size="xs" className="mb-4" color="light"><ArrowLeftIcon className="mr-1 h-4 w-4" />Go Back</Button>
          </Link>
        <div className="mb-6 space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Check Your Resume Against Recruiter Expectations
          </h1>
        </div>

        <ResumeAnalysisForm />
      </section>
    </main>
  );
}
