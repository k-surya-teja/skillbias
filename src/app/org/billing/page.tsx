"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { OrgPageShell } from "@/components/org/OrgPageShell";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  cancelSubscription,
  createCheckout,
  getBilling,
} from "@/lib/ats/billing";
import type {
  BillingResponse,
  PaidPlanId,
  PlanCatalogEntry,
  PlanId,
} from "@/lib/ats/types";

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

export default function OrgBillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization, isLoaded, refreshOrg } = useAuth();
  const toast = useToast();

  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBilling();
      setData(res);
      setError("");
    } catch (loadErr) {
      setError(loadErr instanceof Error ? loadErr.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!organization) {
      router.replace("/org/login");
      return;
    }
    void load();
  }, [isLoaded, organization, router, load]);

  // Surface a one-time success toast if redirected back from checkout
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Subscription updated");
      router.replace("/org/billing");
    } else if (status === "cancelled") {
      toast.error("Checkout cancelled");
      router.replace("/org/billing");
    }
  }, [searchParams, router, toast]);

  async function handleUpgrade(planId: PaidPlanId) {
    if (!data) return;
    setWorking(true);
    try {
      const res = await createCheckout(planId);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      // Demo / immediate upgrade path
      toast.success(res.message ?? "Plan upgraded");
      await Promise.all([load(), refreshOrg()]);
    } catch (upgradeErr) {
      toast.error(upgradeErr instanceof Error ? upgradeErr.message : "Upgrade failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    setWorking(true);
    try {
      await cancelSubscription();
      toast.success("Subscription cancelled");
      setConfirmCancel(false);
      await Promise.all([load(), refreshOrg()]);
    } catch (cancelErr) {
      toast.error(cancelErr instanceof Error ? cancelErr.message : "Cancel failed");
    } finally {
      setWorking(false);
    }
  }

  if (loading || !data) {
    return (
      <OrgPageShell>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
        </div>
      </OrgPageShell>
    );
  }

  const isPro = data.plan === "pro";
  const isPaid = data.plan !== "free";
  const isDemo = data.paymentProvider === "demo";

  // Pick the next tier up from the current plan as the suggested upgrade.
  const suggestedUpgrade = data.plans.find(
    (p) => PLAN_RANK[p.id] === PLAN_RANK[data.plan] + 1,
  ) as PlanCatalogEntry | undefined;

  return (
    <OrgPageShell>
      <div className="min-w-0 space-y-4 px-3 md:px-0">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">
              Billing & plan
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your SkillBias subscription and see your usage.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        {isDemo && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <strong>Demo mode:</strong> Upgrades are applied instantly without payment. Connect Stripe to take real charges (see <code>billingController.ts</code>).
            </p>
          </div>
        )}

        {/* CURRENT PLAN + USAGE */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Current plan
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold capitalize text-gray-900 dark:text-white">
                  {data.plan}
                  <PlanBadge plan={data.plan} status={data.subscriptionStatus} />
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {isPro && data.currentPeriodEnd
                    ? `Renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
                    : isPro
                      ? "Active subscription"
                      : "You're on the free tier"}
                </p>
              </div>
              <CreditCard className="h-6 w-6 text-indigo-500" />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <Stat
                icon={<Sparkles className="h-3.5 w-3.5 text-indigo-500" />}
                label="Active jobs"
                value={data.usage.jobsActive}
              />
              <Stat
                icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
                label="Posts this month"
                value={data.usage.jobsThisMonth}
              />
              <Stat
                icon={<Users className="h-3.5 w-3.5 text-fuchsia-500" />}
                label="Applicants this month"
                value={data.usage.applicantsThisMonth}
              />
            </div>

            {!isPro && data.freeJobUsed && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <strong>Free job credit used.</strong> Upgrade to Pro to post more roles.
              </div>
            )}
          </div>

          {/* Action card */}
          <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {isPro
                ? "Manage subscription"
                : suggestedUpgrade
                  ? `Upgrade to ${suggestedUpgrade.name}`
                  : "Plan"}
            </p>

            {isPro ? (
              <>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                  You can cancel any time. You&apos;ll keep Pro features until the period
                  end.
                </p>
                <div className="mt-auto pt-4">
                  {confirmCancel ? (
                    <div className="space-y-2">
                      <p className="text-xs text-rose-700 dark:text-rose-400">
                        Cancel subscription? You&apos;ll drop back to the free plan.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={working}
                          className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {working ? "Cancelling…" : "Yes, cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancel(false)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                    >
                      Cancel subscription
                    </button>
                  )}
                </div>
              </>
            ) : suggestedUpgrade ? (
              <>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                  {suggestedUpgrade.description}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {suggestedUpgrade.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-4 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpgrade(suggestedUpgrade.id as PaidPlanId)}
                    disabled={working}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {working ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Working…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Upgrade to {suggestedUpgrade.name} · $
                        {suggestedUpgrade.priceMonthly}/mo
                      </>
                    )}
                  </button>
                  {isPaid && (
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-900"
                    >
                      Cancel & return to free
                    </button>
                  )}
                </div>
                {isPaid && confirmCancel && (
                  <div className="mt-3 space-y-2 rounded-md border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950/30">
                    <p className="text-xs text-rose-700 dark:text-rose-400">
                      Drop back to the free plan?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={working}
                        className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {working ? "Cancelling…" : "Yes, cancel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700"
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* PRICING TABLE */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            Compare plans
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {data.plans.map((plan) => {
              const currentRank = PLAN_RANK[data.plan];
              const planRank = PLAN_RANK[plan.id];
              const action: "current" | "upgrade" | "downgrade" =
                plan.id === data.plan
                  ? "current"
                  : planRank > currentRank
                    ? "upgrade"
                    : "downgrade";
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  action={action}
                  disabled={working}
                  onSelect={() => {
                    if (action === "upgrade" && plan.id !== "free") {
                      handleUpgrade(plan.id as PaidPlanId);
                    } else if (action === "downgrade" && plan.id === "free") {
                      setConfirmCancel(true);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Need an Enterprise plan with SSO and custom SLAs?{" "}
          <a
            href="mailto:hello@skillbias.example"
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Contact us
          </a>
          .
        </p>
      </div>
    </OrgPageShell>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
      <p className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function PlanBadge({ plan, status }: { plan: PlanId; status: string }) {
  if (plan !== "free" && status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Active
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Canceled
      </span>
    );
  }
  if (plan === "free") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Free
      </span>
    );
  }
  return null;
}

function PlanCard({
  plan,
  action,
  disabled,
  onSelect,
}: {
  plan: PlanCatalogEntry;
  action: "current" | "upgrade" | "downgrade";
  disabled: boolean;
  onSelect: () => void;
}) {
  const isCurrent = action === "current";
  const isHighlighted = !!plan.highlight;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border p-5 ${
        isCurrent
          ? "border-indigo-300 bg-indigo-50/40 dark:border-indigo-800 dark:bg-indigo-950/30"
          : isHighlighted
            ? "border-indigo-200 bg-white shadow-md shadow-indigo-100/40 dark:border-indigo-900 dark:bg-gray-950"
            : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
      }`}
    >
      {(isHighlighted || isCurrent) && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
        </div>
        {isCurrent ? (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Current
          </span>
        ) : isHighlighted ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Popular
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
        {plan.priceMonthly === 0 ? (
          "Free"
        ) : (
          <>
            ${plan.priceMonthly}
            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
              / month
            </span>
          </>
        )}
      </p>

      <ul className="mt-4 flex-1 space-y-1.5">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {action === "current" ? (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            Current plan
          </button>
        ) : action === "upgrade" ? (
          <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className={`w-full rounded-lg px-3 py-2 text-sm font-semibold shadow-sm disabled:opacity-50 ${
              isHighlighted
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-900"
            }`}
          >
            Upgrade to {plan.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900 disabled:opacity-50"
          >
            Downgrade to {plan.name}
          </button>
        )}
      </div>
    </div>
  );
}
