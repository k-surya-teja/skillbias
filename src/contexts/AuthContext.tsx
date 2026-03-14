"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentOrganization } from "@/lib/ats/auth";
import type { Organization } from "@/lib/ats/types";

type AuthContextValue = {
  organization: Organization | null;
  isLoaded: boolean;
  logout: () => Promise<void>;
  refreshOrg: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshOrg = useCallback(async () => {
    try {
      const res = await getCurrentOrganization();
      setOrganization(res.organization);
    } catch {
      setOrganization(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentOrganization()
      .then((res) => {
        if (!cancelled) setOrganization(res.organization);
      })
      .catch(() => {
        if (!cancelled) setOrganization(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    const { logoutOrganization } = await import("@/lib/ats/auth");
    try {
      await logoutOrganization();
    } catch {
      // continue
    }
    setOrganization(null);
    router.replace("/org/login");
  }, [router]);

  const value: AuthContextValue = {
    organization,
    isLoaded,
    logout,
    refreshOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
