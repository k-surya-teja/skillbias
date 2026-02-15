"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useOrgProfile } from "@/lib/ats/useOrgProfile";

const LINKS = [
  { href: "/org/dashboard", label: "Dashboard" },
  { href: "/org/jobs", label: "Jobs" },
];

type OrgSidebarProps = {
  onNavigate?: () => void;
};

export function OrgSidebar({ onNavigate }: OrgSidebarProps = {}) {
  const pathname = usePathname();
  const { isSignedIn, logout } = useOrgProfile();

  return (
    <aside className="w-full h-full rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 md:w-56">
      <div className="flex h-full min-h-[420px] flex-col justify-between">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Organization
          </p>
          <nav className="space-y-2">
            {LINKS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {isSignedIn && (
          <div className="mt-6 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
