import User from "../schemas/UserSchema.js";
import Transaction from "../schemas/TransactionSchema.js";
import Worker from "../schemas/WorkerSchema.js";

/**
 * Calculate estimated cost for a job
 */
export const calculateEstimatedCost = (workerRate, estimatedDurationHours = 1, minimumCharge = 0.05) => {
    const cost = workerRate * estimatedDurationHours;
    return Math.max(cost, minimumCharge);
};

/**
 * Calculate actual cost based on execution time
 */
export const calculateActualCost = (workerRate, startTime, endTime, minimumCharge = 0.05) => {
    const durationMs = new Date(endTime) - new Date(startTime);
    const durationSeconds = Math.floor(durationMs / 1000);
    const durationHours = durationSeconds / 3600;

    const cost = workerRate * durationHours;
    const finalCost = Math.max(cost, minimumCharge);

    return {
        cost: parseFloat(finalCost.toFixed(4)),
        durationSeconds,
    };
};

/**
 * Reserve funds from user's wallet
 */
export const reserveFunds = async (userId, amount, jobId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: "User not found" };
        }

        if (user.walletBalance < amount) {
            return { success: false, error: "Insufficient wallet balance" };
        }

        user.walletBalance -= amount;
        await user.save();

        const transaction = await Transaction.create({
            userId,
            type: "reservation",
            amount,
            status: "completed",
            jobId,
            description: `Reserved ₹${amount.toFixed(2)} for job`,
        });

        return { success: true, transaction };
    } catch (error) {
        console.error("Reserve funds error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Charge funds for completed job
 */
export const chargeFunds = async (userId, amount, jobId, workerId) => {
    try {
        const transaction = await Transaction.create({
            userId,
            type: "charge",
            amount,
            status: "completed",
            jobId,
            description: `Charged ₹${amount.toFixed(2)} for completed job`,
        });

        if (workerId) {
            const worker = await Worker.findById(workerId);
            if (worker) {
                worker.totalEarnings += amount;
                worker.pendingEarnings -= amount;
                await worker.save();
            }
        }

        return { success: true, transaction };
    } catch (error) {
        console.error("Charge funds error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Refund funds to user's wallet
 */
export const refundFunds = async (userId, amount, jobId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: "User not found" };
        }

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
        console.error("Refund funds error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Validate if user has sufficient balance
 */
export const validateSufficientBalance = async (userId, amount) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { sufficient: false, error: "User not found" };
        }

        return {
            sufficient: user.walletBalance >= amount,
            balance: user.walletBalance,
        };
    } catch (error) {
        console.error("Validate balance error:", error);
        return { sufficient: false, error: error.message };
    }
};

/**
 * Add funds to user's wallet (after successful payment)
 * Updates the existing pending transaction instead of creating a duplicate.
 */
export const addFundsToWallet = async (userId, amount, razorpayOrderId, razorpayPaymentId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { success: false, error: "User not found" };
        }

        user.walletBalance += amount;
        await user.save();

        // Update existing pending transaction rather than creating a new one
        let transaction = await Transaction.findOneAndUpdate(
            { razorpayOrderId, status: "pending" },
            {
                status: "completed",
                razorpayPaymentId,
                description: `Wallet top-up of ₹${amount.toFixed(2)}`,
            },
            { new: true }
        );

        // Fallback: only create a new record if no matching pending transaction exists
        // (e.g. webhook fires before verify, or for fake top-ups)
        if (!transaction) {
            transaction = await Transaction.create({
                userId,
                type: "topup",
                amount,
                status: "completed",
                razorpayOrderId,
                razorpayPaymentId,
                description: `Wallet top-up of ₹${amount.toFixed(2)}`,
            });
        }

        return {
            success: true,
            transaction,
            newBalance: user.walletBalance,
        };
    } catch (error) {
        console.error("Add funds error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Get real-time cost for an ongoing job
 */
export const getRealTimeCost = (workerRate, startTime, minimumCharge = 0.05) => {
    const now = new Date();
    const elapsedMs = now - new Date(startTime);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const elapsedHours = elapsedSeconds / 3600;

    const currentCost = Math.max(workerRate * elapsedHours, minimumCharge);

    return {
        currentCost: parseFloat(currentCost.toFixed(4)),
        elapsedSeconds,
    };
};

/**
 * Credit worker's wallet on job completion
 */
export const creditWorkerWallet = async (workerId, amount, jobId) => {
    try {
        const worker = await Worker.findById(workerId);

        if (!worker) {
            return { success: false, error: "Worker not found" };
        }

        worker.walletBalance += amount;
        worker.totalEarnings += amount;
        if (worker.pendingEarnings >= amount) {
            worker.pendingEarnings -= amount;
        } else {
            worker.pendingEarnings = 0;
        }

        await worker.save();

        const transaction = await Transaction.create({
            userId: worker.userId,
            workerId: worker._id,
            type: "worker_payout",
            amount,
            status: "completed",
            jobId,
            description: `Payment for completed job - ₹${amount.toFixed(2)}`,
        });

        return {
            success: true,
            transaction,
            newBalance: worker.walletBalance,
        };
    } catch (error) {
        console.error("Credit worker wallet error:", error);
        return { success: false, error: error.message };
    }
};