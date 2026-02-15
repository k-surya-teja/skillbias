"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "flowbite-react";
import { useEffect, useRef, useState } from "react";

export function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const updateVisibility = () => {
      const totalScrollable = document.documentElement.scrollHeight - window.innerHeight;
      const threshold = Math.max(totalScrollable * 0.4, 120);
      setIsVisible(window.scrollY >= threshold);
      frameRef.current = null;
    };

    const onScroll = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-0 bottom-4 z-50 px-4"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col items-start justify-between gap-3 rounded-xl border border-indigo-200/70 bg-white/95 p-3 shadow-[0_0_26px_rgba(79,70,229,0.22)] backdrop-blur md:flex-row md:items-center md:px-4 dark:border-indigo-800/70 dark:bg-gray-900/90">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Upload resume → Get score in 15 seconds
            </p>
            <Link href="/resume-check">
              <Button className="group">
                Analyze Resume
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
