"use client";

import { useEffect, useState } from "react";
import { Button, useThemeMode } from "flowbite-react";
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
    <Button
      color="light"
      pill
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="!p-2.5 mr-2 dark:!bg-gray-800 dark:!text-gray-100 dark:hover:!bg-gray-700"
    >
      {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
