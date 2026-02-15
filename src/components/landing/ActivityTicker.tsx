"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const activities = [
  "Someone from Bangalore analyzed resume",
  "Company posted job",
];

export function ActivityTicker() {
  const [index, setIndex] = useState(0);
  const [isPastHero, setIsPastHero] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIndex((previous) => (previous + 1) % activities.length);
    }, 4200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.max(window.innerHeight * 0.78, 460);
      setIsPastHero(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <AnimatePresence>
      {isPastHero ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed right-4 top-24 z-30 hidden md:block"
        >
          <div className="min-w-[300px] rounded-lg border border-indigo-200/70 bg-white/85 px-3 py-2 shadow-[0_0_22px_rgba(99,102,241,0.14)] backdrop-blur dark:border-indigo-800/70 dark:bg-gray-900/75">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Live activity
            </p>
            <div className="mt-1 h-5 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={activities[index]}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs text-gray-700 dark:text-gray-200"
                >
                  {activities[index]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
