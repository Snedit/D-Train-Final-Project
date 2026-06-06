import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

// Uses STRIPE_SECRET_KEY from .env — set to sk_test_... for dev mode
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

/**
 * Create a Stripe Embedded Checkout Session for wallet top-up.
 * Uses ui_mode: "embedded" — no redirect, renders inside a modal.
 * @param {number} amount   Amount in INR (rupees)
 * @param {string} userId   MongoDB user ID (stored in metadata)
 * @param {string} receipt  Unique receipt string
 */
export const createCheckoutSession = async (amount, userId, receipt) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      ui_mode: "embedded",                         // ← key change
      line_items: [
        {
          price_data: {
            currency: "inr",
            unit_amount: Math.round(amount * 100), // paise
            product_data: {
              name: "DTrain Wallet Top-up",
              description: `Add ₹${amount.toFixed(2)} to your DTrain wallet`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        receipt,
        type: "wallet_topup",
      },
      // return_url is called by the embedded component after payment
      // {CHECKOUT_SESSION_ID} is auto-replaced by Stripe
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/wallet?session_id={CHECKOUT_SESSION_ID}&status=success`,
    });
    return { success: true, session };
  } catch (error) {
    console.error("Stripe session creation error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Retrieve a completed Checkout Session
 */
export const retrieveSession = async (sessionId) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return { success: true, session };
  } catch (error) {
    console.error("Stripe retrieve session error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Verify Stripe webhook signature
 */
export const verifyWebhookSignature = (rawBody, signature) => {
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return { valid: true, event };
  } catch (error) {
    console.error("Stripe webhook verification error:", error);
    return { valid: false, error: error.message };
  }
};

/**
 * Create a Transfer / Payout to a worker's bank account (Stripe Connect)
 * In test mode this simulates a payout — no real money moves.
 * @param {string} stripeAccountId  Worker's Stripe Connected Account ID
 * @param {number} amount           Amount in INR
 * @param {string} description      Payout description
 */
export const createWorkerPayout = async (stripeAccountId, amount, description) => {
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // paise
      currency: "inr",
      destination: stripeAccountId,
      description,
    });
    return { success: true, transfer };
  } catch (error) {
    console.error("Stripe payout error:", error);
    return { success: false, error: error.message };
  }
};

export default stripe;