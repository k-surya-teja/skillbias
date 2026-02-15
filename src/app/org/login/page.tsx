"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { Button } from "flowbite-react";
import Image from "next/image";
import { AppNavbar } from "@/components/navbar";
import { ensureAtsSessionFromClerk } from "@/lib/ats/clerkSession";

export default function OrgLoginPage() {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [syncError, setSyncError] = useState("");
  const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    void (async () => {
      try {
        setSyncError("");
        await ensureAtsSessionFromClerk(getToken);
        router.replace("/org/dashboard");
      } catch {
        setSyncError("Login succeeded, but ATS session sync failed. Check Clerk env keys.");
      }
    })();
  }, [getToken, isLoaded, isSignedIn, router]);

  return (
    <main className="min-h-screen">
      <AppNavbar />
      <section className="mx-auto max-w-6xl px-3 py-10">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="grid md:grid-cols-5">
            <div className="relative min-h-[320px] overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-sky-500 p-8 text-white md:col-span-3 md:min-h-[640px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(circle_at_50%_90%,rgba(255,255,255,0.2),transparent_38%)]" />
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div>
                  <p className="inline-flex rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    SkillBias ATS
                  </p>

                  <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-md">
                      <h2 className="text-3xl font-bold leading-tight md:text-4xl">
                        Hire faster with a visual hiring workspace.
                      </h2>
                      <p className="mt-4 text-sm text-white/90 md:text-base">
                        Track jobs, rank applicants, and run your organization hiring process
                        from one dashboard.
                      </p>
                    </div>

                    <div className="w-full max-w-[100px] rounded-xl border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
                      <Image
                        src="/logo-light.png"
                        alt="SkillBias brand"
                        width={170}
                        height={80}
                        priority
                        className="h-auto w-full object-contain"
                      />
                    </div>
                  </div>
                </div>

                <div className="relative mt-8 h-56 rounded-2xl border border-white/25 bg-black/20 backdrop-blur-sm md:h-72">
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.15),transparent_55%)] px-6 text-center md:px-10">
                    <blockquote className="max-w-2xl">
                      <p className="text-xl font-semibold leading-relaxed text-white/95 md:text-2xl">
                      "AI Hiring Workspace for Modern Teams"
                      </p>
                      <footer className="mt-3 text-sm uppercase tracking-[0.2em] text-white/70">
                      Upload job → Get ranked candidates → Hire faster
                      </footer>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:col-span-2 md:p-8">
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
                Organization Access
              </h1>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {mode === "login"
                  ? "Sign in to manage jobs and applicants."
                  : "Create your organization account to start hiring."}
              </p>

              <div className="mb-4 flex items-center gap-3">
                <Button color={mode === "login" ? "dark" : "light"} onClick={() => setMode("login")}>
                  Login
                </Button>
                <Button color={mode === "signup" ? "dark" : "light"} onClick={() => setMode("signup")}>
                  Sign up
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                {!hasClerkKey && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                    Missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in root `.env`.
                  </p>
                )}
                {syncError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{syncError}</p>}
                <SignedOut>
                  {mode === "login" ? (
                    <SignIn
                      routing="hash"
                      signUpUrl="/org/login"
                      forceRedirectUrl="/org/dashboard"
                      fallbackRedirectUrl="/org/dashboard"
                    />
                  ) : (
                    <SignUp
                      routing="hash"
                      signInUrl="/org/login"
                      forceRedirectUrl="/org/dashboard"
                      fallbackRedirectUrl="/org/dashboard"
                    />
                  )}
                </SignedOut>

                <SignedIn>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    You are signed in. Redirecting to your organization workspace...
                  </p>
                </SignedIn>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
