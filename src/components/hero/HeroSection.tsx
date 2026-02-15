"use client";

import Link from "next/link";
import { Button } from "flowbite-react";
import { useAuth } from "@clerk/nextjs";
import { HeroCard, type HeroCardData } from "./HeroCard";

export function HeroSection() {
  const { isSignedIn } = useAuth();

  const heroCards: HeroCardData[] = [
    {
      title: "Resume Analysis",
      description: "Upload your resume and see how you rank instantly.",
      buttonText: "Analyze Resume",
      href: "/resume-check",
      icon: "resume",
    },
    {
      title: "Organization Tracker",
      description:
        "Create jobs and automatically rank candidates using AI.",
      buttonText: isSignedIn ? "Go to Dashboard" : "For Companies",
      href: isSignedIn ? "/org/dashboard" : "/org/entry",
      icon: "company",
    },
  ];

  return (
    <section className="relative min-h-screen w-full overflow-hidden px-4 sm:px-6">
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-100 via-white to-purple-100 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/70" />

        <div className="absolute left-1/2 top-[-150px] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-purple-400/40 blur-[140px] dark:bg-purple-700/30" />

        <div className="absolute right-[10%] bottom-[-100px] h-[400px] w-[600px] rounded-full bg-blue-400/30 blur-[140px] dark:bg-blue-600/25" />

        <div className="absolute inset-0 opacity-10 
          bg-[linear-gradient(to_right,#000_1px,transparent_1px),
              linear-gradient(to_bottom,#000_1px,transparent_1px)]
          bg-[size:60px_60px] dark:opacity-20 dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)]" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex min-h-screen items-center pt-28 pb-14 md:py-24">
        <div className="w-full">
          <div className="mb-10 text-center md:mb-16">
            <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-6xl">
              Stop guessing.
              <span className="block mr-1 text-gray-500 dark:text-gray-400">
                Know where your resume stands.
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base text-gray-600 dark:text-gray-300 md:mt-6 md:text-lg">
              SkillBias analyzes resumes like recruiters do.
              Individuals get feedback. Companies get ranked candidates.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-5 md:flex-row md:gap-6">
              {heroCards.map((card) => (
                <HeroCard key={card.href} {...card} />
              ))}
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-indigo-200/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75 md:mt-12 md:p-6">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="text-left">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white md:text-2xl">
                  Start your free trial today
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                  Post your first job for free, track applicants in one dashboard, and
                  see AI-powered candidate rankings instantly.
                </p>
              </div>
              <Link href="/org/entry" className="w-full md:w-auto md:shrink-0">
                <Button className="w-full whitespace-nowrap md:w-auto">Start Free Trial</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
