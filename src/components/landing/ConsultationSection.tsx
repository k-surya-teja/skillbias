"use client";

import { motion } from "framer-motion";
import { CalendarCheck2, CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { Button } from "flowbite-react";

const points = [
  "Eliminate first-round screening with instant AI-based shortlisting.",
  "Filter out resume noise and hiring fuss in minutes, not days.",
  "Walk away with a fast, clear execution plan tailored to your goals.",
];

const people = [
  "https://api.dicebear.com/9.x/personas/svg?seed=Anaya",
  "https://api.dicebear.com/9.x/personas/svg?seed=Rohan",
  "https://api.dicebear.com/9.x/personas/svg?seed=Meera",
];

export function ConsultationSection() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-fuchsia-50/40 to-white dark:from-gray-950 dark:via-fuchsia-950/15 dark:to-gray-950" />
        <div className="absolute left-1/2 top-4 h-56 w-[30rem] -translate-x-1/2 rounded-full bg-fuchsia-400/15 blur-[110px] dark:bg-fuchsia-700/20" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-6xl rounded-2xl border border-indigo-200/70 bg-white/90 p-6 shadow-[0_0_30px_rgba(99,102,241,0.16)] backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75 md:p-8"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
              <CalendarCheck2 className="h-4 w-4" />
              Free 1:1 Session
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              Skip first-round screening and hire faster
            </h2>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 md:text-base">
              We help you cut the fuss, filter faster, and move only the best-fit
              candidates forward.
            </p>

            <ul className="mt-5 space-y-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <Link href="/org/login">
                <Button className="whitespace-nowrap">Claim Free 1:1 Meeting</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-fuchsia-50 p-5 dark:border-indigo-800/60 dark:from-indigo-950/30 dark:to-fuchsia-950/20">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Faster filtering. Better candidates. Less manual work.
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              AI-generated personas representing typical candidate and hiring profiles.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {people.map((person, index) => (
                <div
                  key={`${person}-${index}`}
                  className="rounded-lg border border-indigo-200/70 bg-white/80 p-2 dark:border-indigo-800/70 dark:bg-gray-900/80"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={person}
                    alt={`AI generated profile ${index + 1}`}
                    className="h-auto w-full rounded-md object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
