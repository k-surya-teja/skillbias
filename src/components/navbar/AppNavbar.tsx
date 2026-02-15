"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Button,
  Dropdown,
  DropdownItem,
  Navbar,
  NavbarBrand,
  useThemeMode,
} from "flowbite-react";
import { CircleUserRound, Loader2, LogOut, Menu } from "lucide-react";
import Image from "next/image";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";
import { useOrgProfile } from "@/lib/ats/useOrgProfile";
import { cn } from "@/lib/utils";
import { ThemeModeToggle } from "./ThemeModeToggle";

type AppNavbarProps = {
  onOpenSidebar?: () => void;
  homeScrollMorph?: boolean;
};

export function AppNavbar({ onOpenSidebar, homeScrollMorph = false }: AppNavbarProps = {}) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { computedMode } = useThemeMode();
  const { companyName, logout } = useOrgProfile();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPastHero, setIsPastHero] = useState(!homeScrollMorph);
  const logoSrc = computedMode === "dark" ? "/logo-light.png" : "/logo.png";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Best effort sync so ATS backend cookie is available.
    void ensureAtsSessionFromClerk(getToken).catch(() => {});
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!homeScrollMorph) {
      return;
    }

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
      <NavbarBrand href="/" className="flex items-center gap-2">
        <Image
          src={logoSrc}
          alt="SkillBias logo"
          width={120}
          height={24}
          priority
          className="h-6 w-auto"
        />
        <span className="self-center whitespace-nowrap text-3xl font-semibold dark:text-white">
          SkillBias
        </span>
      </NavbarBrand>

      <div className="flex items-center gap-2 md:order-2">
        {onOpenSidebar && (
          <Button color="light" pill className="md:hidden !p-2.5" onClick={onOpenSidebar}>
            <Menu className="h-5 w-5" />
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
              <span className="flex items-center rounded-full border border-gray-200 p-2.5 dark:border-gray-700">
                <CircleUserRound className="h-5 w-5" />
              </span>
            }
          >
            <DropdownItem icon={CircleUserRound}>{companyName}</DropdownItem>
            <DropdownItem
              icon={isLoggingOut ? () => <Loader2 className="h-4 w-4 animate-spin" /> : LogOut}
              onClick={() => {
                if (isLoggingOut) {
                  return;
                }
                setIsLoggingOut(true);
                void logout().finally(() => setIsLoggingOut(false));
              }}
            >
              {isLoggingOut ? "Logging you out..." : "Logout"}
            </DropdownItem>
          </Dropdown>
        ) : (
          <Button color="light" pill href="/org/login">
            Sign In
          </Button>
        )}
      </div>
    </Navbar>
  );
}
