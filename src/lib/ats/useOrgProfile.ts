"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { ensureAtsSessionFromClerk } from "./clerkSession";
import { logoutOrganization } from "./auth";

export function useOrgProfile() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [companyName, setCompanyName] = useState("Organization");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    let active = true;
    void ensureAtsSessionFromClerk(getToken)
      .then((organization) => {
        if (active) {
          setCompanyName(organization.companyName || "Organization");
        }
      })
      .catch(() => {
        if (active) {
          setCompanyName("Organization");
        }
      });

    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  async function logout(): Promise<void> {
    try {
      await logoutOrganization();
    } catch {
      // Continue and sign out Clerk even if backend cookie clear fails.
    }
    await signOut({ redirectUrl: "/org/login" });
  }

  return {
    isLoaded,
    isSignedIn,
    companyName,
    logout,
  };
}
