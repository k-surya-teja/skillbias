"use client";

import { useAuth } from "@/contexts/AuthContext";

export function useOrgProfile() {
  const { organization, isLoaded, logout } = useAuth();
  const isSignedIn = !!organization;
  const companyName = organization?.companyName ?? "Organization";

  return {
    isLoaded,
    isSignedIn,
    companyName,
    logout,
  };
}
