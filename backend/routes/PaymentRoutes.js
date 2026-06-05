import { Router } from "express";
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import User from "../schemas/UserSchema.js";
import Worker from "../schemas/WorkerSchema.js";
import Transaction from "../schemas/TransactionSchema.js";
import {
  createCheckoutSession,
  retrieveSession,
  verifyWebhookSignature,
  createWorkerPayout,
} from "../utils/stripeClient.js";
import { addFundsToWallet } from "../utils/paymentHelpers.js";

const PaymentRouter = Router();

// ─────────────────────────────────────────────────────────────
// GET /wallet/balance
// ─────────────────────────────────────────────────────────────
PaymentRouter.get("/wallet/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("walletBalance");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.walletBalance, currency: "INR" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /wallet/topup  — create Stripe Checkout session
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/wallet/topup", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    if (amount < 10)
      return res.status(400).json({ message: "Minimum top-up amount is ₹10" });

    const receipt = `TUP_${Date.now()}_${req.user.userId}`;
    const result = await createCheckoutSession(amount, req.user.userId, receipt);

    if (!result.success)
      return res.status(500).json({ message: "Failed to create payment session", error: result.error });

    // Create pending transaction — updated by webhook or verify endpoint
    await Transaction.create({
      userId: req.user.userId,
      type: "topup",
      amount,
      status: "pending",
      description: `Wallet top-up of ₹${amount.toFixed(2)}`,
      metadata: { stripeSessionId: result.session.id },
    });

    res.json({
      message: "Checkout session created",
      sessionId: result.session.id,
      checkoutUrl: result.session.url,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /stripe/verify  — called after user returns from Stripe
//   Frontend sends: { sessionId }
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/stripe/verify", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId)
      return res.status(400).json({ message: "sessionId required" });

    const result = await retrieveSession(sessionId);
    if (!result.success)
      return res.status(400).json({ message: "Could not retrieve session", error: result.error });

    const session = result.session;

    if (session.payment_status !== "paid")
      return res.status(400).json({ message: "Payment not completed", status: session.payment_status });

    // Prevent double-crediting
    const already = await Transaction.findOne({
      "metadata.stripeSessionId": sessionId,
      status: "completed",
    });
    if (already)
      return res.json({ message: "Already processed", newBalance: null });

    const amount = session.amount_total / 100; // paise → rupees
    const userId = session.metadata?.userId || req.user.userId;

    const addResult = await addFundsToWallet(userId, amount, sessionId);
    if (!addResult.success)
      return res.status(500).json({ message: "Failed to add funds", error: addResult.error });

    res.json({
      message: "Payment verified and wallet updated",
      newBalance: addResult.newBalance,
      transaction: {
        id: addResult.transaction._id,
        amount: addResult.transaction.amount,
        status: addResult.transaction.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /wallet/fake-topup  — DEV ONLY (no Stripe needed)
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/wallet/fake-topup", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    if (amount > 10000)
      return res.status(400).json({ message: "Maximum fake top-up is ₹10,000" });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.walletBalance += amount;
    await user.save();

    const transaction = await Transaction.create({
      userId: req.user.userId,
      type: "topup",
      amount,
      status: "completed",
      description: `[DEV] Fake wallet top-up of ₹${amount.toFixed(2)}`,
      metadata: { isFake: true },
    });

    res.json({
      message: "Fake balance added (DEV MODE)",
      newBalance: user.walletBalance,
      transaction: { id: transaction._id, amount, status: "completed" },
      note: "⚠️ Dev-mode fake top-up. Switch to Stripe for real payments.",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /wallet/transactions
// ─────────────────────────────────────────────────────────────
PaymentRouter.get("/wallet/transactions", authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;
    const query = { userId: req.user.userId };
    if (type) query.type = type;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate("jobId", "title status");

    const total = await Transaction.countDocuments(query);
    res.json({ transactions, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /stripe/webhook  — Stripe sends events here
//   Must be registered with raw body parser (see index.js)
// ─────────────────────────────────────────────────────────────
PaymentRouter.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const { valid, event, error } = verifyWebhookSignature(req.body, sig);

    if (!valid) {
      console.error("❌ Invalid Stripe webhook signature:", error);
      return res.status(400).json({ message: "Invalid signature" });
    }

    console.log(`📥 Stripe webhook: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const amount = session.amount_total / 100;
        const userId = session.metadata?.userId;
        if (userId) {
          const result = await addFundsToWallet(userId, amount, session.id);
          if (result.success) {
            console.log(`✅ Stripe webhook: ₹${amount} added to user ${userId}`);
          } else {
            console.error(`⚠️ Stripe webhook addFunds failed: ${result.error}`);
          }
        }
      }
    }

    res.json({ received: true });
  }
);

// ─────────────────────────────────────────────────────────────
// POST /worker/payout-request
//   Worker requests a cash payout of their in-app wallet balance
//   In test/dev mode this simply marks a pending payout record.
//   In production it would trigger a Stripe Connect transfer.
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/worker/payout-request", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker)
      return res.status(404).json({ message: "Worker not found. Register as a worker first." });

    if (worker.walletBalance < amount)
      return res.status(400).json({
        message: "Insufficient worker wallet balance",
        available: worker.walletBalance,
        requested: amount,
      });

    // Deduct from wallet immediately — payout is in-progress
    worker.walletBalance -= amount;
    await worker.save();

    let stripeResult = null;
    let payoutStatus = "pending";

    // If worker has a Stripe Connected Account, trigger real payout
    if (worker.stripeAccountId) {
      stripeResult = await createWorkerPayout(
        worker.stripeAccountId,
        amount,
        `DTrain payout for worker ${worker.deviceId}`
      );
      payoutStatus = stripeResult.success ? "completed" : "failed";

      if (!stripeResult.success) {
        // Rollback wallet deduction on failure
        worker.walletBalance += amount;
        await worker.save();
        return res.status(500).json({
          message: "Payout failed",
          error: stripeResult.error,
        });
      }
    }
    // else: no Stripe account → stays as "pending" (admin processes manually)

    const transaction = await Transaction.create({
      userId: req.user.userId,
      workerId: worker._id,
      type: "withdrawal",
      amount,
      status: payoutStatus,
      description: `Payout request of ₹${amount.toFixed(2)}`,
      metadata: {
        stripeTransferId: stripeResult?.transfer?.id || null,
        note: worker.stripeAccountId
          ? "Stripe Connect transfer initiated"
          : "Manual payout pending — no Stripe account connected",
      },
    });

    res.json({
      message: worker.stripeAccountId
        ? "Payout initiated via Stripe"
        : "Payout request recorded. Connect a Stripe account for instant payouts.",
      transaction: { id: transaction._id, amount, status: payoutStatus },
      newWalletBalance: worker.walletBalance,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /worker/payout-history
// ─────────────────────────────────────────────────────────────
PaymentRouter.get("/worker/payout-history", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker)
      return res.status(404).json({ message: "Worker not found" });

    const payouts = await Transaction.find({
      workerId: worker._id,
      type: { $in: ["withdrawal", "worker_payout"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("jobId", "title");

    res.json({
      payouts: payouts.map((p) => ({
        id: p._id,
        type: p.type,
        amount: p.amount,
        status: p.status,
        description: p.description,
        jobTitle: p.jobId?.title || null,
        createdAt: p.createdAt,
      })),
      walletBalance: worker.walletBalance,
      totalEarnings: worker.totalEarnings,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default PaymentRouter;