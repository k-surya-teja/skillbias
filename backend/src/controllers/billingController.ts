import { Response } from "express";
import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";

// Plan catalog kept on the server so frontend pricing stays in sync.
export const PLAN_CATALOG = [
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
] as const;

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro"]),
});

export async function getBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const organization = await OrganizationModel.findById(orgId).select(
    "plan freeJobUsed subscriptionStatus currentPeriodEnd",
  );
  if (!organization) {
    res.status(404).json({ message: "Organization not found" });
    return;
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalJobs, jobsThisMonth, jobIdDocs, applicantsThisMonth] = await Promise.all([
    JobModel.countDocuments({ orgId }),
    JobModel.countDocuments({ orgId, createdAt: { $gte: startOfMonth } }),
    JobModel.find({ orgId }).select("_id"),
    (async () => {
      const ids = await JobModel.find({ orgId }).select("_id");
      return ApplicationModel.countDocuments({
        jobId: { $in: ids.map((d) => d._id) },
        createdAt: { $gte: startOfMonth },
      });
    })(),
  ]);

  res.json({
    plan: organization.plan,
    subscriptionStatus: organization.subscriptionStatus ?? "none",
    currentPeriodEnd: organization.currentPeriodEnd ?? null,
    freeJobUsed: organization.freeJobUsed,
    usage: {
      totalJobs,
      jobsThisMonth,
      applicantsThisMonth,
      jobsActive: jobIdDocs.length,
    },
    plans: PLAN_CATALOG,
    paymentProvider: "demo", // swap to "stripe" once real keys are wired
  });
}

export async function createCheckout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { plan } = checkoutSchema.parse(req.body);

  // === Stripe integration point ===
  // When STRIPE_SECRET_KEY is configured, replace the demo block below with:
  //   1. Resolve or create a Stripe Customer for this org (cache id on Organization.stripeCustomerId).
  //   2. Create a Checkout Session with mode: "subscription" and the price ID for the requested plan.
  //   3. Set success_url to FRONTEND_ORIGIN + "/org/billing?status=success" and cancel_url similarly.
  //   4. Return { checkoutUrl: session.url } and finish.
  // A webhook (POST /billing/webhook) would then mark the subscription active on checkout.session.completed.

  // Demo mode: flip plan immediately so the upgrade flow is testable end-to-end.
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await OrganizationModel.findByIdAndUpdate(orgId, {
    plan,
    subscriptionStatus: "active",
    currentPeriodEnd: periodEnd,
  });

  res.json({
    ok: true,
    demo: true,
    plan,
    message: "Demo upgrade applied. Connect Stripe to take real payments.",
  });
}

export async function cancelSubscription(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Stripe integration point: call stripe.subscriptions.cancel(stripeSubscriptionId)
  // and downgrade locally on the customer.subscription.deleted webhook.

  await OrganizationModel.findByIdAndUpdate(orgId, {
    plan: "free",
    subscriptionStatus: "canceled",
    currentPeriodEnd: null,
  });

  res.json({ ok: true, plan: "free" });
}
