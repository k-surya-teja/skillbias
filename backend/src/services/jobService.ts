import { JobModel } from "../models/Job.js";

export async function autoCloseExpiredJobs(): Promise<void> {
  await JobModel.updateMany(
    { status: "active", endDate: { $lt: new Date() } },
    { $set: { status: "closed" } },
  );
}
