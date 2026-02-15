"use client";

import { motion } from "framer-motion";
import { BarChart3, Bot, Briefcase, Link2, Upload, Wrench } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

type TabId = "candidates" | "companies";

type Step = {
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
};

const stepMap: Record<TabId, Step[]> = {
  candidates: [
    {
      title: "Upload resume",
      description: "Submit your resume in seconds to start ATS and recruiter-style analysis.",
      Icon: Upload,
    },
    {
      title: "AI analyzes like recruiter",
      description: "We evaluate content, structure, and keyword relevance against hiring signals.",
      Icon: Bot,
    },
    {
      title: "Get score + fixes",
      description: "Receive your score with prioritized improvements you can apply immediately.",
      Icon: Wrench,
    },
  ],
  companies: [
    {
      title: "Create job",
      description: "Post a role and define what matters most for shortlisting candidates.",
      Icon: Briefcase,
    },
    {
      title: "Share link",
      description: "Invite applicants using a simple shareable job link across channels.",
      Icon: Link2,
    },
    {
      title: "Auto-rank candidates",
      description: "Automatically rank submissions with clear scores and fit explanations.",
      Icon: BarChart3,
    },
  ],
};

const containerVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function HowItWorks() {
  const [activeTab, setActiveTab] = useState<TabId>("candidates");

  const steps = useMemo(() => stepMap[activeTab], [activeTab]);

  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-indigo-50/60 to-white dark:from-gray-950 dark:via-indigo-950/25 dark:to-gray-950" />
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:60px_60px] dark:opacity-20 dark:bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)]" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-6xl"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            How SkillBias works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
            Built for candidates improving interview outcomes and companies hiring
            faster.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mx-auto mt-8 flex w-full max-w-md rounded-xl border border-indigo-200/70 bg-white/85 p-1 shadow-[0_0_30px_rgba(79,70,229,0.12)] backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75"
          role="tablist"
          aria-label="How it works audience tabs"
        >
          {[
            { id: "candidates" as const, label: "For Candidates" },
            { id: "companies" as const, label: "For Companies" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => setActiveTab(tab.id)}
              className={`w-1/2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-indigo-50 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        <motion.div
          id={`${activeTab}-panel`}
          role="tabpanel"
          aria-live="polite"
          key={activeTab}
          className="mt-6 grid gap-4 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {steps.map((step, index) => (
            <motion.article
              key={`${step.title}-${activeTab}`}
              variants={itemVariants}
              className="group rounded-xl border border-indigo-200/70 bg-white/90 p-5 shadow-[0_0_24px_rgba(79,70,229,0.08)] transition hover:scale-[1.01] hover:shadow-[0_0_34px_rgba(79,70,229,0.2)] dark:border-indigo-800/70 dark:bg-gray-900/75"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                  Step {index + 1}
                </span>
                <step.Icon className="h-5 w-5 text-indigo-600 transition group-hover:text-indigo-500 dark:text-indigo-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {step.description}
              </p>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
