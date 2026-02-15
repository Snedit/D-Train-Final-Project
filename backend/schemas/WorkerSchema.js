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
      hourlyRate: { type: Number, default: 0.10 }, // Default $0.10/hour
      minimumCharge: { type: Number, default: 0.05 }, // Minimum charge per job
      currency: { type: String, default: "INR" }, // Indian Rupees for Razorpay
    },

    // Earnings tracking
    totalEarnings: { type: Number, default: 0 },
    pendingEarnings: { type: Number, default: 0 }, // From in-progress jobs
  },
  { timestamps: true }
);

export default mongoose.model("Worker", workerSchema);
