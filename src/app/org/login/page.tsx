"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Label, TextInput } from "flowbite-react";
import Image from "next/image";
import { AppNavbar } from "@/components/navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { loginOrganization, signInWithGoogle, signupOrganization } from "@/lib/ats/auth";

export default function OrgLoginPage() {
  return (
    <Suspense>
      <OrgLoginContent />
    </Suspense>
  );
}

function OrgLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoaded, setOrganization } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const urlError = searchParams.get("error");

  useEffect(() => {
    if (!isLoaded) return;
    if (organization) {
      router.replace("/org/dashboard");
      return;
    }
    if (urlError) {
      const messages: Record<string, string> = {
        oauth_failed: "Google sign-in failed. Please try again.",
      };
      setError(messages[urlError] ?? "Something went wrong. Please try again.");
    }
  }, [isLoaded, organization, router, urlError]);

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      // Browser is redirected to Google; nothing to do here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await loginOrganization({ email: email.trim(), password });
        setOrganization(res.organization);
        toast.success("Signed in successfully");
        router.replace("/org/dashboard");
      } else {
        if (!companyName.trim()) {
          setError("Company name is required.");
          setLoading(false);
          return;
        }
        const res = await signupOrganization({
          companyName: companyName.trim(),
          email: email.trim(),
          password,
        });
        setOrganization(res.organization);
        toast.success("Account created successfully");
        router.replace("/org/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen">
        <AppNavbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-500" />
        </div>
      </main>
    );
  }

  if (organization) {
    return null;
  }

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
                        Track jobs, rank applicants, and run your organization hiring process from
                        one dashboard.
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

              <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    mode === "login"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    mode === "signup"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  Sign up
                </button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                {error && (
                  <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  {mode === "signup" && (
                    <div>
                      <Label htmlFor="companyName">Company name</Label>
                      <TextInput
                        id="companyName"
                        type="text"
                        placeholder="Acme Inc"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required={mode === "signup"}
                        disabled={loading}
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <TextInput
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <TextInput
                      id="password"
                      type="password"
                      placeholder={mode === "login" ? "••••••••" : "Min 8 characters"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      disabled={loading}
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
                  </Button>
                </form>

                <div className="mt-4 flex items-center gap-2">
                  <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-500">or</span>
                  <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
