"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AppNavbar } from "@/components/navbar";
import { OrgSidebar } from "./OrgSidebar";

type OrgPageShellProps = {
  children: React.ReactNode;
};

export function OrgPageShell({ children }: OrgPageShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <AppNavbar onOpenSidebar={() => setMobileSidebarOpen(true)} />

      <div className="md:pl-64">
        <aside className="fixed top-[65px] left-0 z-30 hidden h-[calc(100vh-65px)] w-64 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:block">
          <OrgSidebar />
        </aside>

        <section className="mx-0 w-auto py-6 md:mx-[6%] md:py-10">{children}</section>
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
            <OrgSidebar onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </>
      )}
    </main>
  );
}
