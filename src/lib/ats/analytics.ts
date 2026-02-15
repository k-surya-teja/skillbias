import { atsFetch } from "./api";
import { DashboardStatsResponse } from "./types";

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  return atsFetch("/dashboard/stats");
}
