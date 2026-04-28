"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeApiLoading } from "@/lib/ats/loadingStore";

const SHOW_DELAY_MS = 250;

/**
 * Floating "Loading…" pill that appears whenever any atsFetch call is in
 * flight. Delayed by 250ms so fast requests don't make it flicker on/off.
 */
export function ApiLoadingIndicator() {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearShowTimer() {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    }

    const unsub = subscribeApiLoading((count) => {
      if (count > 0) {
        // Only schedule a show if we don't already have one queued or visible.
        if (!visible && !showTimer.current) {
          showTimer.current = setTimeout(() => {
            setVisible(true);
            showTimer.current = null;
          }, SHOW_DELAY_MS);
        }
      } else {
        clearShowTimer();
        setVisible(false);
      }
    });

    return () => {
      clearShowTimer();
      unsub();
    };
    // We intentionally don't depend on `visible` — the closure reads the
    // latest state via React's render cycle, and re-subscribing on every
    // toggle would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-3 right-3 z-[90] flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
      Loading…
    </div>
  );
}
