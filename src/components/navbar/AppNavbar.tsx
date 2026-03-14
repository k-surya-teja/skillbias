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
            onClick={toggleSidebar}
            className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:inline-flex"
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
        {onOpenSidebar && (
          <Button color="light" pill className="md:hidden !p-2" onClick={onOpenSidebar}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
        <ThemeModeToggle />
        {isSignedIn ? (
          <Dropdown
            inline
            arrowIcon={false}
            theme={{
              floating: {
                base: "z-[70] w-fit divide-y divide-gray-100 rounded shadow focus:outline-none",
              },
            }}
            label={
              <span className="flex items-center rounded-full border border-gray-200 p-2 dark:border-gray-700">
                <CircleUserRound className="h-4 w-4" />
              </span>
            }
          >
            <DropdownItem icon={CircleUserRound}>{companyName}</DropdownItem>
            <DropdownItem
              icon={isLoggingOut ? () => <Loader2 className="h-4 w-4 animate-spin" /> : LogOut}
              onClick={() => {
                if (isLoggingOut) return;
                setIsLoggingOut(true);
                void logout().finally(() => setIsLoggingOut(false));
              }}
            >
              {isLoggingOut ? "Logging you out..." : "Logout"}
            </DropdownItem>
          </Dropdown>
        ) : (
          <Button color="light" pill size="sm" href="/org/login">
            Sign In
          </Button>
        )}
      </div>
    </Navbar>
  );
}
