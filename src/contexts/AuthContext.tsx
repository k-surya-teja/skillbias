"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentOrganization } from "@/lib/ats/auth";
import { disconnectAtsSocket } from "@/lib/ats/socket";
import type { Organization } from "@/lib/ats/types";

type AuthContextValue = {
  organization: Organization | null;
  isLoaded: boolean;
  logout: () => Promise<void>;
  refreshOrg: () => Promise<void>;
  /** Replace the org in context (e.g. after login/signup) without a network round-trip. */
  setOrganization: (org: Organization | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
    // 1. Tell the backend to clear the auth cookie. Don't fail the local
    //    cleanup if the network request errors — we still want to log the
    //    user out client-side.
    const { logoutOrganization } = await import("@/lib/ats/auth");
    try {
      await logoutOrganization();
    } catch {
      // Continue with local teardown even if the call fails.
    }

    // 2. Tear down anything that might hold session/org-scoped state.
    setOrganization(null);
    disconnectAtsSocket();

    // 3. Defensive sweep of web storage in case any future code stashes
    //    user-specific data there. Today we don't, so this is a safety net.
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.clear();
        window.localStorage.clear();
      } catch {
        // Storage may be blocked (private mode, ITP, etc.) — ignore.
      }
    }

    // 4. Hard-redirect (not router.replace) so the entire React tree
    //    unmounts. This guarantees no stale AuthContext, no stale page
    //    state, no leftover socket listeners — a true blank slate.
    if (typeof window !== "undefined") {
      window.location.href = "/org/login";
    }
  }, []);

  const value: AuthContextValue = {
    organization,
    isLoaded,
    logout,
    refreshOrg,
    setOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
