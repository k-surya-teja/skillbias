"use client";

import { useEffect, useState } from "react";
import { useThemeMode } from "flowbite-react";
import { Moon, Sun } from "lucide-react";

export function ThemeModeToggle() {
  const { computedMode, setMode, toggleMode } = useThemeMode();
  const [isMounted, setIsMounted] = useState(false);
  const resolvedMode = isMounted ? computedMode : "light";
  const isDarkMode = resolvedMode === "dark";
  const label = isDarkMode ? "Switch to light mode" : "Switch to dark mode";

  useEffect(() => {
    setIsMounted(true);
    const domMode = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

    if (computedMode !== domMode) {
      setMode(domMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="flex items-center rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
