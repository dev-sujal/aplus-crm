import { TestAssignment } from "../models/TestAssignment.model.js";
import { TestAttempt } from "../models/TestAttempt.model.js";
import { finalizeExpiredAttemptById } from "../controllers/attempts.controller.js";

let jobTimer: NodeJS.Timeout | null = null;

async function runExpiryCycle() {
  try {
    await runExpiryCycleUnsafe();
  } catch (error) {
    console.error("[test-expiry] cycle failed:", error);
  }
}

async function runExpiryCycleUnsafe() {
  const now = new Date();
  const expiredAttempts = await TestAttempt.find({ status: "in_progress", expiresAt: { $lte: now } }).select("_id");
  for (const attempt of expiredAttempts) {
    await finalizeExpiredAttemptById(attempt.id);
  }

  await TestAssignment.updateMany(
    {
      status: { $in: ["not_started", "in_progress"] },
      availabilityEnd: { $lt: now },
      revokedAt: null,
    },
    { status: "expired" }
  );
}

export function startTestExpiryJob() {
  if (jobTimer) return;
  void runExpiryCycle();
  jobTimer = setInterval(() => {
    void runExpiryCycle();
  }, 60_000);
  jobTimer.unref();
}
