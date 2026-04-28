"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, CheckCircle2, FileText, Sparkles, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden px-4 sm:px-6">
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/60" />
        <div className="absolute left-1/2 top-[-180px] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-400/30 blur-[140px] dark:bg-violet-700/20" />
        <div className="absolute right-[-10%] bottom-[-160px] h-[420px] w-[620px] rounded-full bg-indigo-400/30 blur-[140px] dark:bg-indigo-600/20" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:48px_48px] dark:opacity-[0.08] dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)]" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-65px)] max-w-7xl items-center pt-20 pb-12 md:pt-28 md:pb-20">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          {/* LEFT — copy + CTAs */}
          <div className="text-center lg:text-left">
            {/* Status pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur dark:border-indigo-800 dark:bg-gray-900/70 dark:text-indigo-300">
              <Sparkles className="h-3 w-3" />
              AI-powered ATS · Open beta
            </span>

            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              Stop guessing.{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400">
                Know where your resume stands.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 dark:text-gray-300 md:text-lg lg:mx-0">
              SkillBias scores resumes the way recruiters actually do. Get instant
              feedback if you're job-hunting — or AI-ranked candidates if you're hiring.
            </p>

            {/* Dual CTA */}
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:items-center lg:justify-start">
              <Link
                href="/resume-check"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-900/20 transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:shadow-white/10 dark:hover:bg-gray-100"
              >
                <FileText className="h-4 w-4" />
                Check my resume
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/org/login"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white/80 px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm backdrop-blur transition hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:text-white dark:hover:bg-gray-900"
              >
                <Briefcase className="h-4 w-4" />
                Hire with SkillBias
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Trust strip */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-400 lg:justify-start">
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No signup for resume check
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> First job post free
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Results in seconds
              </li>
            </ul>
          </div>

          {/* RIGHT — product preview */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  // Stylized "score card" hero illustration. Static — purely visual proof of what users get.
  const score = 78;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative">
      {/* Floating decorative pills */}
      <div className="absolute -left-8 top-8 hidden rotate-[-6deg] rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 shadow-md md:block dark:border-emerald-800 dark:bg-gray-900 dark:text-emerald-300">
        ✓ Strong match
      </div>
      <div className="absolute -right-6 -top-4 hidden rotate-[5deg] rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700 shadow-md md:block dark:border-amber-800 dark:bg-gray-900 dark:text-amber-300">
        ⚡ 3 fixes
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-2xl shadow-indigo-200/40 backdrop-blur md:p-6 dark:border-gray-800 dark:bg-gray-950/95 dark:shadow-indigo-950/40">
        {/* Top accent stripe */}
        <div className="-mx-5 -mt-5 mb-4 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 md:-mx-6 md:-mt-6" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Resume analysis
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              senior_frontend_engineer.pdf
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        {/* Gauge + verdict */}
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                className="stroke-gray-200 dark:stroke-gray-800"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-indigo-500"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{score}</span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                / 100
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Overall ATS score
            </p>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              Strong, with tweaks
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
              Solid React experience and quantified impact. Add system-design depth and
              tighten the summary.
            </p>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Skills", value: 84, tone: "bg-emerald-500" },
            { label: "Keywords", value: 71, tone: "bg-amber-500" },
            { label: "Layout", value: 76, tone: "bg-indigo-500" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {s.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                {s.value}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div className={`h-full ${s.tone}`} style={{ width: `${s.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Skill chips */}
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Matched
          </p>
          <div className="flex flex-wrap gap-1">
            {["React", "TypeScript", "Next.js", "Node.js", "GraphQL"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Missing
          </p>
          <div className="flex flex-wrap gap-1">
            {["System design", "AWS", "Testing"].map((s) => (
              <span
                key={s}
                className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Top action */}
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
            High priority
          </p>
          <p className="mt-0.5 text-xs font-medium text-gray-900 dark:text-white">
            Tighten the summary into 2 lines
          </p>
          <p className="text-[11px] text-gray-600 dark:text-gray-400">
            Lead with role + years, then your strongest impact metric.
          </p>
        </div>
      </div>
    </div>
  );
}
