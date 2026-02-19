import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import User from "../schemas/UserSchema.js";
import Transaction from "../schemas/TransactionSchema.js";
import { createOrder, verifyPaymentSignature, verifyWebhookSignature } from "../utils/razorpayClient.js";
import { addFundsToWallet } from "../utils/paymentHelpers.js";

const PaymentRouter = Router();

/**
 * GET /wallet/balance
 * Get current wallet balance
 */
PaymentRouter.get("/wallet/balance", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("walletBalance");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            balance: user.walletBalance,
            currency: "INR",
        });
    } catch (error) {
        console.error("Get balance error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /wallet/fake-topup
 * Add fake balance for testing (DEVELOPMENT ONLY)
 */
PaymentRouter.post("/wallet/fake-topup", authMiddleware, async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        if (amount > 10000) {
            return res.status(400).json({ message: "Maximum fake top-up is ₹10,000" });
        }

        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.walletBalance += amount;
        await user.save();

        const transaction = await Transaction.create({
            userId: req.user.userId,
            type: "topup",
            amount,
            status: "completed",
            description: `Fake wallet top-up of ₹${amount.toFixed(2)} (TESTING)`,
            metadata: {
                isFake: true,
                note: "Development testing only"
            }
        });

        console.log(`💰 Fake top-up: ₹${amount} added to user ${req.user.userId}`);

        res.json({
            message: "Fake balance added successfully",
            newBalance: user.walletBalance,
            transaction: {
                id: transaction._id,
                amount: transaction.amount,
                status: transaction.status,
            },
            note: "⚠️ This is a fake top-up for testing. Use real Razorpay once configured."
        });
    } catch (error) {
        console.error("Fake top-up error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /wallet/topup
 * Create Razorpay order for wallet top-up
 */
PaymentRouter.post("/wallet/topup", authMiddleware, async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        if (amount < 10) {
            return res.status(400).json({ message: "Minimum top-up amount is ₹10" });
        }

        const receipt = `TUP_${Date.now()}`;
        const result = await createOrder(amount, receipt, {
            userId: req.user.userId,
            type: "wallet_topup",
        });

        if (!result.success) {
            return res.status(500).json({
                message: "Failed to create payment order",
                error: result.error
            });
        }

        // Create ONE pending transaction here — it will be updated (not duplicated)
        // by addFundsToWallet when payment is verified
        await Transaction.create({
            userId: req.user.userId,
            type: "topup",
            amount,
            status: "pending",
            razorpayOrderId: result.order.id,
            description: `Wallet top-up of ₹${amount.toFixed(2)}`,
        });

        res.json({
            message: "Payment order created",
            orderId: result.order.id,
            amount: result.order.amount,
            currency: result.order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("Wallet top-up error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /razorpay/verify
 * Verify Razorpay payment and add funds to wallet
 */
PaymentRouter.post("/razorpay/verify", authMiddleware, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing payment details" });
        }

        const isValid = verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        );

        if (!isValid) {
            return res.status(400).json({ message: "Invalid payment signature" });
        }

        // Find the pending transaction to get amount and userId
        const pendingTransaction = await Transaction.findOne({
            razorpayOrderId: razorpay_order_id,
            status: "pending",
        });

        if (!pendingTransaction) {
            return res.status(404).json({ message: "Transaction not found" });
        }

        // addFundsToWallet will update the existing pending transaction to
        // "completed" — no duplicate is created
        const result = await addFundsToWallet(
            pendingTransaction.userId,
            pendingTransaction.amount,
            razorpay_order_id,
            razorpay_payment_id
        );

        if (!result.success) {
            return res.status(500).json({
                message: "Failed to add funds",
                error: result.error
            });
        }

        // Save the signature onto the now-completed transaction
        result.transaction.razorpaySignature = razorpay_signature;
        await result.transaction.save();

        res.json({
            message: "Payment verified successfully",
            newBalance: result.newBalance,
            transaction: {
                id: result.transaction._id,
                amount: result.transaction.amount,
                status: result.transaction.status,
            },
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * GET /wallet/transactions
 * Get transaction history
 */
PaymentRouter.get("/wallet/transactions", authMiddleware, async (req, res) => {
    try {
        const { limit = 20, offset = 0, type } = req.query;

        const query = { userId: req.user.userId };
        if (type) {
            query.type = type;
        }

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(offset))
            .populate("jobId", "title status");

        const total = await Transaction.countDocuments(query);

        res.json({
            transactions,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });
    } catch (error) {
        console.error("Get transactions error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

/**
 * POST /razorpay/webhook
 * Handle Razorpay webhook events
 */
PaymentRouter.post("/razorpay/webhook", async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);

        const isValid = verifyWebhookSignature(body, signature);

        if (!isValid) {
            console.error("Invalid webhook signature");
            return res.status(400).json({ message: "Invalid signature" });
        }

        const event = req.body.event;
        const payload = req.body.payload.payment.entity;

        console.log(`📥 Webhook received: ${event}`);

        if (event === "payment.captured") {
            const orderId = payload.order_id;
            const paymentId = payload.id;

            const transaction = await Transaction.findOne({
                razorpayOrderId: orderId,
                status: "pending",
            });

            if (transaction) {
                // addFundsToWallet updates the existing pending transaction —
                // no duplicate even if webhook and verify both fire
                const result = await addFundsToWallet(
                    transaction.userId,
                    transaction.amount,
                    orderId,
                    paymentId
                );

                if (result.success) {
                    console.log(`✅ Wallet topped up via webhook: ₹${transaction.amount} for user ${transaction.userId}`);
                }
            }
        }

        if (event === "payment.failed") {
            const orderId = payload.order_id;

            const transaction = await Transaction.findOne({
                razorpayOrderId: orderId,
                status: "pending",
            });

            if (transaction) {
                transaction.status = "failed";
                await transaction.save();
                console.log(`❌ Payment failed for order ${orderId}`);
            }
        }

        res.json({ status: "ok" });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ message: "Webhook processing error" });
    }
});

/**
 * GET /transactions
 * Get all user transactions with filters
 */
PaymentRouter.get("/transactions", authMiddleware, async (req, res) => {
    try {
        const { status, type, startDate, endDate } = req.query;

        const query = { userId: req.user.userId };

        if (status) query.status = status;
        if (type) query.type = type;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const transactions = await Transaction.find(query)
            .sort({ createdAt: -1 })
            .populate("jobId", "title status");

        res.json({ transactions });
    } catch (error) {
        console.error("Get transactions error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

export default PaymentRouter;