import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BillingResponse, CheckoutResponse, PaidPlanId, PlanCatalogEntry } from "./types";

// Plan catalog lives client-side; mirrors the Express implementation.
const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    description: "Try SkillBias with one open role.",
    features: [
      "1 job post (all-time)",
      "AI candidate scoring",
      "Cross-job candidates view",
      "Basic dashboard",
    ],
    limits: { jobPosts: 1 },
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 29,
    description: "For small teams hiring a handful of roles.",
    features: [
      "Up to 10 active job posts",
      "Auto-shortlist & auto-reject rules",
      "All Free features",
      "Email support",
    ],
    limits: { jobPosts: 10 },
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    description: "For active hiring teams at scale.",
    features: [
      "Unlimited job posts",
      "All Starter features",
      "Custom branding (coming soon)",
      "Priority support",
    ],
    limits: { jobPosts: null },
  },
];

export async function getBilling(): Promise<BillingResponse> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startISO = startOfMonth.toISOString();

  const [orgRes, totalJobsRes, jobsThisMonthRes, activeJobsRes, jobIdsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("plan, free_job_used, subscription_status, current_period_end")
      .eq("user_id", user.id)
      .single(),
    supabase.from("jobs").select("*", { count: "exact", head: true }),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startISO),
    supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("jobs").select("id"),
  ]);

  if (orgRes.error || !orgRes.data) throw new Error("Billing lookup failed.");
  const org = orgRes.data as {
    plan: "free" | "starter" | "pro";
    free_job_used: boolean;
    subscription_status:
      | "active"
      | "canceled"
      | "trialing"
      | "past_due"
      | "none";
    current_period_end: string | null;
  };

  // Applicants this month: scoped by jobs the org owns (RLS already enforces this).
  const jobIds = ((jobIdsRes.data ?? []) as Array<{ id: string }>).map((j) => j.id);
  let applicantsThisMonth = 0;
  if (jobIds.length > 0) {
    const { count } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .in("job_id", jobIds)
      .gte("created_at", startISO);
    applicantsThisMonth = count ?? 0;
  }

  return {
    plan: org.plan,
    subscriptionStatus: org.subscription_status,
    currentPeriodEnd: org.current_period_end,
    freeJobUsed: org.free_job_used,
    usage: {
      totalJobs: totalJobsRes.count ?? 0,
      jobsThisMonth: jobsThisMonthRes.count ?? 0,
      applicantsThisMonth,
      jobsActive: activeJobsRes.count ?? 0,
    },
    plans: PLAN_CATALOG,
    // Flip to "stripe" once a Next.js API route at /api/billing/checkout
    // is wired with STRIPE_SECRET_KEY.
    paymentProvider: "demo",
  };
}

export async function createCheckout(plan: PaidPlanId): Promise<CheckoutResponse> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  // Demo: flip the plan immediately so the upgrade flow is testable.
  // Real Stripe integration moves this to a server route and a webhook handler.
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { error } = await supabase
    .from("organizations")
    .update({
      plan,
      subscription_status: "active",
      current_period_end: periodEnd.toISOString(),
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  return {
    ok: true,
    demo: true,
    plan,
    message: "Demo upgrade applied. Connect Stripe to take real payments.",
  };
}

export async function cancelSubscription(): Promise<{ ok: true; plan: "free" }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { error } = await supabase
    .from("organizations")
    .update({
      plan: "free",
      subscription_status: "canceled",
      current_period_end: null,
    })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  return { ok: true, plan: "free" };
}
