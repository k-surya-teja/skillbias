"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    question: "Is resume stored?",
    answer:
      "Resumes are processed for analysis and then removed based on retention policy. We keep storage minimal and focused on user safety.",
  },
  {
    question: "How accurate is scoring?",
    answer:
      "Scores are calibrated against common ATS and recruiter expectations. Use the detailed feedback to improve fit for your target roles.",
  },
  {
    question: "Is it free?",
    answer:
      "You can start with a free experience and explore core analysis workflows before upgrading.",
  },
  {
    question: "ATS friendly?",
    answer:
      "Yes. We evaluate readability, keyword coverage, and structure to help your resume perform better in ATS-first pipelines.",
  },
  {
    question: "Can I see why score is low?",
    answer:
      "Yes. SkillBias highlights missing keywords, weak sections, and prioritized fixes so you can improve quickly.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative w-full overflow-hidden px-6 py-16 md:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-violet-50/50 to-white dark:from-gray-950 dark:via-violet-950/20 dark:to-gray-950" />
      </div>

      <motion.div
        className="relative z-10 mx-auto max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-600 dark:text-gray-300 md:text-base">
            Quick answers about privacy, ATS scoring, and what you get in each report.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const contentId = `faq-content-${index}`;

            return (
              <motion.div
                key={faq.question}
                className="rounded-xl border border-indigo-200/70 bg-white/90 shadow-[0_0_18px_rgba(99,102,241,0.1)] transition hover:shadow-[0_0_28px_rgba(99,102,241,0.18)] dark:border-indigo-800/70 dark:bg-gray-900/75"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left md:px-5 md:py-4"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white md:text-base">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-indigo-600 transition-transform dark:text-indigo-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={contentId}
                      key={`${faq.question}-content`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="border-t border-indigo-100 px-4 py-3 text-sm text-gray-600 dark:border-indigo-900/60 dark:text-gray-300 md:px-5 md:py-4">
                        {faq.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
