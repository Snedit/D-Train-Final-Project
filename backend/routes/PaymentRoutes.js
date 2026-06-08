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
import { addFundsToWallet, getAvailableBalance } from "../utils/paymentHelpers.js";

const PaymentRouter = Router();

// ─────────────────────────────────────────────────────────────
// GET /wallet/balance  — returns total, reserved, and available
// ─────────────────────────────────────────────────────────────
PaymentRouter.get("/wallet/balance", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("walletBalance reservedBalance");
    if (!user) return res.status(404).json({ message: "User not found" });
    const available = getAvailableBalance(user);
    res.json({
      balance:   user.walletBalance,          // total in wallet
      reserved:  user.reservedBalance ?? 0,   // locked for active jobs
      available,                              // what can actually be spent
      currency: "INR",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/user/wallet  — alias used by App.tsx fetchWalletBalance
// ─────────────────────────────────────────────────────────────
PaymentRouter.get("/user-wallet", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("walletBalance reservedBalance");
    if (!user) return res.status(404).json({ message: "User not found" });
    const available = getAvailableBalance(user);
    res.json({
      walletBalance: user.walletBalance,
      reserved:      user.reservedBalance ?? 0,
      available,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /wallet/topup  — create Stripe Embedded Checkout session
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/wallet/topup", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    if (amount < 50)
      return res.status(400).json({ message: "Minimum top-up amount is ₹50 (Stripe minimum)" });

    const receipt = `TUP_${Date.now()}_${req.user.userId}`;
    const result  = await createCheckoutSession(amount, req.user.userId, receipt);
    if (!result.success)
      return res.status(500).json({ message: "Failed to create payment session", error: result.error });

    await Transaction.create({
      userId:      req.user.userId,
      type:        "topup",
      amount,
      status:      "pending",
      description: `Wallet top-up of ₹${amount.toFixed(2)}`,
      metadata:    { stripeSessionId: result.session.id },
    });

    res.json({
      message:      "Checkout session created",
      sessionId:    result.session.id,
      clientSecret: result.session.client_secret,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /stripe/verify  — called after embedded checkout completes
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/stripe/verify", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    const result = await retrieveSession(sessionId);
    if (!result.success)
      return res.status(400).json({ message: "Could not retrieve session", error: result.error });

    const session = result.session;
    if (session.payment_status !== "paid")
      return res.status(400).json({ message: "Payment not completed", status: session.payment_status });

    const already = await Transaction.findOne({
      "metadata.stripeSessionId": sessionId,
      status: "completed",
    });
    if (already) return res.json({ message: "Already processed", newBalance: null });

    const amount = session.amount_total / 100;
    const userId = session.metadata?.userId || req.user.userId;

    const addResult = await addFundsToWallet(userId, amount, sessionId);
    if (!addResult.success)
      return res.status(500).json({ message: "Failed to add funds", error: addResult.error });

    // Return full balance breakdown so frontend can update immediately
    const user      = await User.findById(userId).select("walletBalance reservedBalance");
    const available = getAvailableBalance(user);

    res.json({
      message:    "Payment verified and wallet updated",
      newBalance: addResult.newBalance,
      reserved:   user.reservedBalance ?? 0,
      available,
      transaction: {
        id:     addResult.transaction._id,
        amount: addResult.transaction.amount,
        status: addResult.transaction.status,
      },
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
// POST /stripe/cancel  — marks abandoned checkout as cancelled
// Called when user closes the Stripe modal without paying
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/stripe/cancel", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    const result = await Transaction.findOneAndUpdate(
      { "metadata.stripeSessionId": sessionId, status: "pending", userId: req.user.userId },
      { status: "failed", description: "Payment cancelled by user (modal closed)" },
      { new: true }
    );

    if (!result) {
      // Already processed or not found — safe to ignore
      return res.json({ message: "No pending transaction found", cancelled: false });
    }

    console.log(`🚫 Stripe session ${sessionId} cancelled by user — transaction marked failed`);
    res.json({ message: "Transaction cancelled", cancelled: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /stripe/webhook
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
// ─────────────────────────────────────────────────────────────
PaymentRouter.post("/worker/payout-request", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "Worker not found. Register as a worker first." });

    if (worker.walletBalance < amount)
      return res.status(400).json({
        message: "Insufficient worker wallet balance",
        available: worker.walletBalance,
        requested: amount,
      });

    worker.walletBalance -= amount;
    await worker.save();

    let stripeResult = null;
    let payoutStatus = "pending";

    if (worker.stripeAccountId) {
      stripeResult = await createWorkerPayout(
        worker.stripeAccountId, amount,
        `DTrain payout for worker ${worker.deviceId}`
      );
      payoutStatus = stripeResult.success ? "completed" : "failed";

      if (!stripeResult.success) {
        worker.walletBalance += amount;
        await worker.save();
        return res.status(500).json({ message: "Payout failed", error: stripeResult.error });
      }
    }

    const transaction = await Transaction.create({
      userId:   req.user.userId,
      workerId: worker._id,
      type:     "withdrawal",
      amount,
      status:   payoutStatus,
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
      transaction:      { id: transaction._id, amount, status: payoutStatus },
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
    if (!worker) return res.status(404).json({ message: "Worker not found" });

    const payouts = await Transaction.find({
      workerId: worker._id,
      type: { $in: ["withdrawal", "worker_payout"] },
    }).sort({ createdAt: -1 }).limit(50).populate("jobId", "title");

    res.json({
      payouts: payouts.map((p) => ({
        id: p._id, type: p.type, amount: p.amount, status: p.status,
        description: p.description, jobTitle: p.jobId?.title || null, createdAt: p.createdAt,
      })),
      walletBalance: worker.walletBalance,
      totalEarnings: worker.totalEarnings,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default PaymentRouter;