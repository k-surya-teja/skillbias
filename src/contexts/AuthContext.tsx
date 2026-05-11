"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { dbOrgToOrganization } from "@/lib/ats/orgMapper";
import { disconnectAtsSocket } from "@/lib/ats/socket";
import type { OrganizationRow } from "@/lib/supabase/types";
import type { Organization } from "@/lib/ats/types";

type AuthContextValue = {
  organization: Organization | null;
  isLoaded: boolean;
  logout: () => Promise<void>;
  refreshOrg: () => Promise<void>;
  setOrganization: (org: Organization | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchOrgFromSession = useCallback(async (): Promise<Organization | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (error || !data) return null;
    return dbOrgToOrganization(data as OrganizationRow, user.email ?? "");
  }, [supabase]);

  const refreshOrg = useCallback(async () => {
    setOrganization(await fetchOrgFromSession());
  }, [fetchOrgFromSession]);

  useEffect(() => {
    let cancelled = false;

    fetchOrgFromSession()
      .then((org) => {
        if (!cancelled) setOrganization(org);
      })
      .catch(() => {
        if (!cancelled) setOrganization(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    // Keep context in sync with Supabase sign-in / sign-out events fired from
    // anywhere — including the OAuth callback route, server actions, or
    // signOut() called in a different tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      if (!session) {
        setOrganization(null);
        return;
      }
      const org = await fetchOrgFromSession();
      if (!cancelled) setOrganization(org);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchOrgFromSession]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Continue with local teardown even if the call fails.
    }

    setOrganization(null);
    disconnectAtsSocket();

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.clear();
        window.localStorage.clear();
      } catch {
        // Storage may be blocked (private mode, ITP, etc.) — ignore.
      }
      // Hard redirect so the entire React tree unmounts and no stale state survives.
      window.location.href = "/org/login";
    }
  }, [supabase]);

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
