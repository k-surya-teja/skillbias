"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "flowbite-react";
import { useAuth } from "@clerk/nextjs";

const candidates = [
  { name: "Aarav Sharma", score: 93, top: true },
  { name: "Sana Iqbal", score: 89, top: true },
  { name: "Rohan Verma", score: 85, top: true },
  { name: "Neha Das", score: 80, top: false },
  { name: "Kabir Joshi", score: 76, top: false },
];

export function CompanySection() {
  const { isSignedIn } = useAuth();
  const ctaHref = isSignedIn ? "/org/jobs/create" : "/org/login";

  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-indigo-50/50 to-white dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-950" />
        <div className="absolute right-[12%] top-16 h-56 w-56 rounded-full bg-blue-400/20 blur-[100px] dark:bg-blue-700/25" />
      </div>

      <motion.div
        className="relative z-10 mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Stop reading 500 resumes manually
          </h2>
          <p className="mt-4 max-w-lg text-sm text-gray-600 dark:text-gray-300 md:text-base">
            Prioritize top-fit candidates instantly with a ranked pipeline your team can
            trust.
          </p>
          <div className="mt-6">
            <Link href={ctaHref}>
              <Button className="group">
                Create first job free
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200/70 bg-white/90 p-5 shadow-[0_0_34px_rgba(79,70,229,0.18)] backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Candidate ranking dashboard
            </p>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
              Live scoring
            </span>
          </div>

          <ul className="space-y-3">
            {candidates.map((candidate, index) => (
              <li
                key={candidate.name}
                className={`rounded-lg border p-3 ${
                  candidate.top
                    ? "border-indigo-300 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/25"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950/50"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-gray-900 dark:text-white">
                    #{index + 1} {candidate.name}
                  </p>
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {candidate.score}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${candidate.score}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
