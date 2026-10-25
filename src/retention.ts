// Daily retention cleanup for data with a hard deletion deadline.
//
// A single daily timer (pattern: startJobCleanupTimer) with one idempotent step
// per data class. Every step is wrapped in its own try/catch so one failure does
// not stop the others, and multiple instances are harmless (idempotent DELETEs).
// Started once in src/index.ts next to the job cleanup timer.

import { purgeExpiredBugReports, purgeExpiredInvites } from "./db-react.js";
import { config } from "./config.js";

export async function runRetentionSteps(): Promise<void> {
  const steps: Array<[string, () => Promise<number>]> = [
    ["bug_reports", () => purgeExpiredBugReports(config.retention.bugReportMonths)],
    ["invites", () => purgeExpiredInvites(config.retention.inviteDays)],
  ];

  for (const [name, step] of steps) {
    try {
      const removed = await step();
      if (removed > 0) {
        console.log(`[retention] ${name} removed ${removed}`);
      }
    } catch (error) {
      console.error(`[retention] ${name} failed:`, error);
    }
  }
}

export function startRetentionTimer(
  intervalMs: number,
  run: () => Promise<void> = runRetentionSteps,
): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    run().catch((error) => console.error("[retention] run failed:", error));
  }, intervalMs);
  timer.unref();
  return timer;
}
