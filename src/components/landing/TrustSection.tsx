"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Building2, ShieldCheck, Trash2 } from "lucide-react";

const badges = [
  { label: "Secure upload", Icon: ShieldCheck },
  { label: "Data deleted after scan", Icon: Trash2 },
  { label: "Recruiter-style AI", Icon: BadgeCheck },
  { label: "Used by early companies", Icon: Building2 },
];

const logos = ["NEXORA", "HIRINGHUB", "TEAMFORGE", "TALENTO", "APPLYFLOW"];

export function TrustSection() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/50 to-white dark:from-gray-950 dark:via-purple-950/20 dark:to-gray-950" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Trusted signals, transparent process
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
            Designed to keep candidate data safe while giving teams clear hiring context.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((badge) => (
            <motion.div
              key={badge.label}
              className="rounded-xl border border-indigo-200/70 bg-white/90 p-4 shadow-[0_0_24px_rgba(99,102,241,0.12)] transition hover:scale-[1.01] hover:shadow-[0_0_32px_rgba(99,102,241,0.2)] dark:border-indigo-800/70 dark:bg-gray-900/75"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.25 }}
            >
              <badge.Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                {badge.label}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-gray-200/80 bg-white/85 p-4 dark:border-gray-800 dark:bg-gray-900/70">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Early adopters
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {logos.map((logo) => (
              <div
                key={logo}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-xs font-semibold tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
