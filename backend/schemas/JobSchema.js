import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: { type: String, required: true },
    description: { type: String, required: true },

    zipFileUrl: { type: String, required: true },

    config: {
      entryFile: String,
      requirementsFile: String,
      epochs: Number,
      datasetSize: Number,
      other: Object,
    },

    assignedWorkerId: { type: String, ref: "Worker" },

    status: {
      type: String,
      enum: ["pending", "assigned", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },

    // Pricing and payment tracking
    pricing: {
      estimatedCost: Number,
      actualCost: Number,
      workerRate: Number,
      gpuName: String,
      gpuMultiplier: Number,
      effectiveRate: Number,
      startTime: Date,
      endTime: Date,
      durationSeconds: Number,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "reserved", "charged", "refunded"],
      default: "pending",
    },

    logs: [String],
    modelUrl: String,
    errorMessage: String,
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);