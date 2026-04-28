import { atsFetch } from "./api";
import type { BillingResponse, CheckoutResponse, PaidPlanId } from "./types";

export async function getBilling(): Promise<BillingResponse> {
  return atsFetch("/billing");
}

export async function createCheckout(plan: PaidPlanId): Promise<CheckoutResponse> {
  return atsFetch("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

export async function cancelSubscription(): Promise<{ ok: true; plan: "free" }> {
  return atsFetch("/billing/cancel", { method: "POST" });
}
