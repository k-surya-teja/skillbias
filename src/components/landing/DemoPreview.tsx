"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, GaugeCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "flowbite-react";

const issues = ["Weak bullet points", "No metrics", "Formatting problems"];

export function DemoPreview() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50/60 to-white dark:from-gray-950 dark:via-blue-950/20 dark:to-gray-950" />
        <div className="absolute left-1/2 top-0 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-indigo-400/20 blur-[120px] dark:bg-indigo-700/25" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-5xl"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Live Demo Preview
          </h2>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 md:text-base">
            See the kind of recruiter-style insight you get after a single upload.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-xl border border-indigo-200/70 bg-white/90 shadow-[0_0_30px_rgba(79,70,229,0.16)] backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75">
          <div className="p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
                <GaugeCircle className="h-5 w-5" />
                <p className="text-sm font-medium">Resume Analysis Result</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                Top 18%
              </span>
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-950/80">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Resume Score
              </p>
              <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-300">
                72/100
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div className="h-full w-[72%] rounded-full bg-amber-500" />
              </div>

              <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Issues detected
                </p>
                <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                  {issues.map((issue) => (
                    <li key={issue} className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pointer-events-none relative mt-4 h-20 overflow-hidden rounded-lg">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/85 to-white dark:via-gray-900/85 dark:to-gray-900" />
              <div className="absolute inset-x-0 top-0 h-full backdrop-blur-sm" />
            </div>

            <div className="mt-2 flex justify-center">
              <Link href="/resume-check">
                <Button className="group">
                  Try with your resume
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
