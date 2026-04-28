"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  Navbar,
} from "flowbite-react";
import { CircleUserRound, Loader2, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrgProfile } from "@/lib/ats/useOrgProfile";
import { useSidebar } from "@/contexts/SidebarContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { ThemeModeToggle } from "./ThemeModeToggle";

type AppNavbarProps = {
  onOpenSidebar?: () => void;
  homeScrollMorph?: boolean;
};

const navLinks = [
  { href: "/jobs", label: "Jobs" },
  { href: "/resume-check", label: "Resume Check" },
  { href: "/org/entry", label: "Companies" },
] as const;

export function AppNavbar({ onOpenSidebar, homeScrollMorph = false }: AppNavbarProps = {}) {
  const pathname = usePathname();
  const isOrgRoute = pathname.startsWith("/org/") && pathname !== "/org/entry";
  const { companyName, isSignedIn, logout } = useOrgProfile();
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const toast = useToast();
  const [isPastHero, setIsPastHero] = useState(!homeScrollMorph);

  useEffect(() => {
    if (!homeScrollMorph) return;
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
  }, [homeScrollMorph]);

  return (
    <Navbar
      fluid
      className={cn(
        homeScrollMorph ? "fixed top-0 z-50 transition-all duration-300" : "sticky top-0 z-50",
        homeScrollMorph
          ? isPastHero
            ? "left-1/2 mt-0 w-screen max-w-none -translate-x-1/2 rounded-none border-b border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-950"
            : "left-1/2 mt-3 w-[min(96%,1100px)] -translate-x-1/2 rounded-2xl border border-gray-200/70 bg-white/85 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-950/80"
          : "w-full border-b border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-950",
      )}
    >
      <div className="flex items-center gap-2">
        {isOrgRoute && (
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768 && onOpenSidebar) {
                onOpenSidebar();
              } else {
                toggleSidebar();
              }
            }}
            className="inline-flex rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Link href="/" className="flex items-center gap-1.5">
          <img
            src="/logo.png"
            alt="SkillBias logo"
            width={80}
            height={16}
            className="h-4 w-auto dark:hidden"
          />
          <img
            src="/logo-light.png"
            alt="SkillBias logo"
            width={80}
            height={16}
            className="hidden h-4 w-auto dark:block"
          />
          <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
            SkillBias
          </span>
        </Link>
      </div>

      {!isOrgRoute && (
        <div className="hidden items-center gap-6 md:order-1 md:flex">
          {navLinks.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "border-b-2 pb-0.5 text-sm font-medium transition-colors",
                  active
                    ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 md:order-2">
        <ThemeModeToggle />
        {isSignedIn ? (
          <Dropdown
            inline
            arrowIcon={false}
            theme={{
              floating: {
                base: "z-[70] mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-sm shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900",
                target: "w-fit",
                divider: "hidden",
                content: "py-1",
                item: {
                  base: "flex w-full items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:bg-gray-800",
                  icon: "mr-2 h-4 w-4",
                },
              },
            }}
            label={
              <span className="flex items-center rounded-full border border-gray-200 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <CircleUserRound className="h-4 w-4" />
              </span>
            }
          >
            <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                  <CircleUserRound className="h-4 w-4" />
                </span>
                <span
                  className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white"
                  title={companyName}
                >
                  {companyName}
                </span>
              </div>
            </div>
            <DropdownItem
              onClick={() => {
                if (isLoggingOut) return;
                setIsLoggingOut(true);
                void logout()
                  .then(() => toast.success("Logged out successfully"))
                  .catch(() => toast.error("Logout failed"))
                  .finally(() => setIsLoggingOut(false));
              }}
            >
              <span className="flex items-center gap-2">
                {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {isLoggingOut ? "Logging you out..." : "Logout"}
              </span>
            </DropdownItem>
          </Dropdown>
        ) : (
          <Button color="light" pill size="sm" href="/org/login">
            Login
          </Button>
        )}
      </div>
    </Navbar>
  );
}
