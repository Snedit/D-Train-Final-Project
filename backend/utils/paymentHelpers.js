import User from "../schemas/UserSchema.js";
import Transaction from "../schemas/TransactionSchema.js";
import Worker from "../schemas/WorkerSchema.js";

const GPU_TIER_MULTIPLIERS = {
  // NVIDIA
  "rtx 4090": 3.5, "rtx 4080": 3.0, "rtx 4070": 2.5, "rtx 4060": 2.0,
  "rtx 3090": 2.8, "rtx 3080": 2.4, "rtx 3070": 2.0, "rtx 3060": 1.6,
  "rtx 3050": 1.3, "rtx 2080": 2.0, "rtx 2070": 1.7, "rtx 2060": 1.4,
  "gtx 1080": 1.5, "gtx 1070": 1.3, "gtx 1060": 1.1,
  // AMD
  "rx 7900": 3.0, "rx 7800": 2.4, "rx 6900": 2.6,
  "rx 6800": 2.2, "rx 6700": 1.8, "rx 6600": 1.5,
  // Apple Silicon
  "m3 max": 2.8, "m3 pro": 2.2, "m3": 1.8,
  "m2 max": 2.5, "m2 pro": 2.0, "m2": 1.6,
  "m1 max": 2.2, "m1 pro": 1.8, "m1": 1.4,
  // Integrated / unknown
  "n/a": 0.7, "integrated": 0.7, "none": 0.7,
};

const BASE_HOURLY_RATE_INR = 2.0;

export const getGpuMultiplier = (gpuName = "") => {
  const lower = gpuName.toLowerCase();
  for (const [key, multiplier] of Object.entries(GPU_TIER_MULTIPLIERS)) {
    if (lower.includes(key)) return multiplier;
  }
  return 1.0; // unknown GPU — mid-tier
};

export const calculateEstimatedCost = (
  workerRate,
  gpuName = "N/A",
  estimatedDurationHours = 1,
  minimumCharge = 0.05
) => {
  const gpuMultiplier = getGpuMultiplier(gpuName);
  const effectiveRate = Math.max(workerRate, BASE_HOURLY_RATE_INR) * gpuMultiplier;
  const cost = effectiveRate * estimatedDurationHours;
  return parseFloat(Math.max(cost, minimumCharge).toFixed(4));
};

export const calculateActualCost = (
  workerRate,
  gpuName = "N/A",
  startTime,
  endTime
  // ✅ no minimumCharge — charge the exact real cost, even if it's tiny
) => {
  const durationMs = new Date(endTime) - new Date(startTime);
  const durationSeconds = Math.floor(durationMs / 1000);
  const durationHours = durationSeconds / 3600;

  const gpuMultiplier = getGpuMultiplier(gpuName);
  const effectiveRate = Math.max(workerRate, BASE_HOURLY_RATE_INR) * gpuMultiplier;
  const cost = effectiveRate * durationHours;

  return {
    cost: parseFloat(cost.toFixed(4)),   // exact cost, no floor
    durationSeconds,
    gpuMultiplier,
    effectiveRate: parseFloat(effectiveRate.toFixed(4)),
  };
};

// ✅ Default minimumCharge=0 so live cost ticker never shows fake 0.05 floor
export const getRealTimeCost = (workerRate, gpuName = "N/A", startTime, minimumCharge = 0) => {
  const now = new Date();
  const elapsedMs = now - new Date(startTime);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedHours = elapsedSeconds / 3600;

  const gpuMultiplier = getGpuMultiplier(gpuName);
  const effectiveRate = Math.max(workerRate, BASE_HOURLY_RATE_INR) * gpuMultiplier;
  const currentCost = effectiveRate * elapsedHours; // no minimum floor for display

  return {
    currentCost: parseFloat(Math.max(currentCost, minimumCharge).toFixed(4)),
    elapsedSeconds,
    gpuMultiplier,
    effectiveRate: parseFloat(effectiveRate.toFixed(4)),
  };
};

export const validateSufficientBalance = async (userId, amount) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { sufficient: false, error: "User not found" };
    return { sufficient: user.walletBalance >= amount, balance: user.walletBalance };
  } catch (error) {
    return { sufficient: false, error: error.message };
  }
};

// reserveFunds intentionally removed — no pre-charging anywhere in the system

/**
 * ✅ chargeFunds — THE only place money is deducted from user wallet.
 * Called once, after training completes and model is uploaded.
 */
export const chargeFunds = async (userId, amount, jobId, workerId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };

    // Deduct from wallet — this is the real cut
    if (user.walletBalance < amount) {
      console.warn(`⚠️  User ${userId} balance ₹${user.walletBalance} < charge ₹${amount} — charging what's available`);
    }
    user.walletBalance = parseFloat(Math.max(0, user.walletBalance - amount).toFixed(4));
    await user.save();

    const transaction = await Transaction.create({
      userId,
      type: "charge",
      amount,
      status: "completed",
      jobId,
      description: `Charged ₹${amount.toFixed(4)} for completed job`,
    });

    if (workerId) {
      const worker = await Worker.findById(workerId);
      if (worker) {
        worker.totalEarnings += amount;
        worker.pendingEarnings = Math.max(0, worker.pendingEarnings - amount);
        await worker.save();
      }
    }

    return { success: true, transaction };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * refundFunds — kept for any future cancellation logic
 */
export const refundFunds = async (userId, amount, jobId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };

    user.walletBalance += amount;
    await user.save();

    const transaction = await Transaction.create({
      userId,
      type: "refund",
      amount,
      status: "completed",
      jobId,
      description: `Refunded ₹${amount.toFixed(2)} for cancelled/failed job`,
    });

    return { success: true, transaction };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const addFundsToWallet = async (userId, amount, stripeSessionId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: "User not found" };

    user.walletBalance += amount;
    await user.save();

    let transaction = await Transaction.findOneAndUpdate(
      { "metadata.stripeSessionId": stripeSessionId, status: "pending" },
      { status: "completed", description: `Wallet top-up of ₹${amount.toFixed(2)}` },
      { new: true }
    );

    if (!transaction) {
      transaction = await Transaction.create({
        userId,
        type: "topup",
        amount,
        status: "completed",
        description: `Wallet top-up of ₹${amount.toFixed(2)}`,
        metadata: { stripeSessionId },
      });
    }

    return { success: true, transaction, newBalance: user.walletBalance };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const creditWorkerWallet = async (workerId, amount, jobId) => {
  try {
    const worker = await Worker.findById(workerId);
    if (!worker) return { success: false, error: "Worker not found" };

    worker.walletBalance += amount;
    worker.totalEarnings += amount;
    worker.pendingEarnings = Math.max(0, worker.pendingEarnings - amount);
    await worker.save();

    const transaction = await Transaction.create({
      userId: worker.userId,
      workerId: worker._id,
      type: "worker_payout",
      amount,
      status: "completed",
      jobId,
      description: `Earned ₹${amount.toFixed(2)} for completed job`,
    });

    return { success: true, transaction, newBalance: worker.walletBalance };
  } catch (error) {
    return { success: false, error: error.message };
  }
};