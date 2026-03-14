"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppNavbar } from "@/components/navbar";
import { useSidebar } from "@/contexts/SidebarContext";
import { OrgSidebar } from "./OrgSidebar";

export { useSidebar } from "@/contexts/SidebarContext";

type OrgPageShellProps = {
  children: React.ReactNode;
};

export function OrgPageShell({ children }: OrgPageShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { collapsed, collapse, scheduleCollapse, consumePendingCollapse } = useSidebar();

  useEffect(() => {
    if (consumePendingCollapse()) {
      // Double rAF: first frame lets the browser paint the sidebar open,
      // second frame triggers the collapse so the CSS transition plays.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          collapse();
        });
      });
    }
  });

  const handleDesktopNavigate = useCallback(
    (_href: string, _e: MouseEvent) => {
      scheduleCollapse();
      // Let the Link navigate normally
    },
    [scheduleCollapse],
  );

  const handleMobileNavigate = useCallback(
    (_href: string, _e: MouseEvent) => {
      setMobileSidebarOpen(false);
    },
    [],
  );

  return (
    <main className="min-h-screen">
      <AppNavbar onOpenSidebar={() => setMobileSidebarOpen(true)} />

      <div>
        <aside
          className={`fixed top-[65px] left-0 z-30 hidden h-[calc(100vh-65px)] w-64 border-r border-gray-200 bg-white p-4 transition-transform duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-950 md:block ${
            collapsed ? "-translate-x-full" : "translate-x-0"
          }`}
        >
          <OrgSidebar onNavigate={handleDesktopNavigate} />
        </aside>

        <section
          className={`mx-0 w-auto py-6 transition-[margin] duration-300 ease-in-out md:py-10 md:mr-[6%] ${
            collapsed ? "md:ml-[6%]" : "md:ml-[calc(16rem+3%)]"
          }`}
        >
          {children}
        </section>
      </div>

      {mobileSidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
          <div className="fixed top-0 left-0 z-50 h-screen w-72 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:hidden">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-900"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <OrgSidebar onNavigate={handleMobileNavigate} />
          </div>
        </>
      )}
    </main>
  );
}
