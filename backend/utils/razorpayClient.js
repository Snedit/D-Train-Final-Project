import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Initialize Razorpay instance
export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create a Razorpay order for payment
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receipt - Unique receipt ID
 * @param {object} notes - Additional notes
 * @returns {Promise<object>} Razorpay order object
 */
export const createOrder = async (amount, receipt, notes = {}) => {
    try {
        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: "INR",
            receipt: receipt,
            notes: notes,
        };

        const order = await razorpay.orders.create(options);
        return { success: true, order };
    } catch (error) {
        console.error("Razorpay order creation error:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} True if signature is valid
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
    try {
        const text = `${orderId}|${paymentId}`;
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest("hex");

        return generatedSignature === signature;
    } catch (error) {
        console.error("Signature verification error:", error);
        return false;
    }
};

/**
 * Verify webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - Razorpay signature from header
 * @returns {boolean} True if webhook signature is valid
 */
export const verifyWebhookSignature = (body, signature) => {
    try {
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest("hex");

        return expectedSignature === signature;
    } catch (error) {
        console.error("Webhook signature verification error:", error);
        return false;
    }
};

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Payment details
 */
export const fetchPayment = async (paymentId) => {
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return { success: true, payment };
    } catch (error) {
        console.error("Fetch payment error:", error);
        return { success: false, error: error.message };
    }
};

export default razorpay;
