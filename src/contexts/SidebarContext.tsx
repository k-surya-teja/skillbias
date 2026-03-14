"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  /** Mark that the sidebar should animate closed after the next navigation */
  scheduleCollapse: () => void;
  /** Check and consume the pending flag (returns true if a collapse was scheduled) */
  consumePendingCollapse: () => boolean;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  collapse: () => {},
  scheduleCollapse: () => {},
  consumePendingCollapse: () => false,
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pendingRef = useRef(false);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);
  const collapse = useCallback(() => setCollapsed(true), []);

  const scheduleCollapse = useCallback(() => {
    pendingRef.current = true;
  }, []);

  const consumePendingCollapse = useCallback(() => {
    if (pendingRef.current) {
      pendingRef.current = false;
      return true;
    }
    return false;
  }, []);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle, collapse, scheduleCollapse, consumePendingCollapse }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
