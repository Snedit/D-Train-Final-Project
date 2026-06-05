import mongoose from "mongoose";

const workerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deviceId: { type: String, required: true, unique: true },

    systemInfo: {
      cpu: String,
      gpu: String,
      ram: String,
    },

    networkInfo: {
      ip: String,
      speed: String,
    },

    currentStatus: {
      type: String,
      enum: ["online", "offline", "idle", "busy"],
      default: "offline",
    },

    lastHeartbeatAt: Date,
    currentJobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },

    totalJobsCompleted: { type: Number, default: 0 },
    walletAddress: String,
    ratings: { type: Number, default: 5 },

    // Pricing configuration
    pricing: {
      hourlyRate: { type: Number, default: 2.0 },       // ₹2/hour base
      minimumCharge: { type: Number, default: 0.05 },   // Minimum per job
      currency: { type: String, default: "INR" },
    },

    // Earnings tracking
    totalEarnings: { type: Number, default: 0 },
    pendingEarnings: { type: Number, default: 0 },  // In-progress jobs
    walletBalance: { type: Number, default: 0 },    // Available for withdrawal

    // Stripe Connect — for real bank payouts (optional)
    // Worker links their Stripe account via onboarding flow to enable instant payouts
    stripeAccountId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Worker", workerSchema);