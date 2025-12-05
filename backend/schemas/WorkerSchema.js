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
  },
  { timestamps: true }
);

export default mongoose.model("Worker", workerSchema);
