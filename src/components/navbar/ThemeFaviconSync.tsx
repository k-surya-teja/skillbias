"use client";

import { useEffect } from "react";
import { useThemeMode } from "flowbite-react";

export function ThemeFaviconSync() {
  const { computedMode } = useThemeMode();

  useEffect(() => {
    const href = computedMode === "dark" ? "/logo-light.png" : "/logo.png";
    const cacheBustedHref = `${href}?theme=${computedMode}`;
    const head = document.head;

    let iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");

    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      head.appendChild(iconLink);
    }

    iconLink.type = "image/png";
    iconLink.href = cacheBustedHref;
  }, [computedMode]);

  return null;
}
