import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    acceptedAt: { type: Date },
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
      // draft   = uploaded, priced, waiting for user to pay & publish
      // pending = paid, reserved, visible to workers
      enum: ["draft", "pending", "assigned", "processing", "completed", "failed", "cancelled"],
      default: "draft",
    },

    // Tier-based flat pricing — set by Groq+rule-engine at upload time, stored on job
    pricing: {
      tierPrice: Number,
      workerPay: Number,
      platformFee: Number,
      actualCost: Number,   // set on completion
      gpuName: String,
      startTime: Date,
      endTime: Date,
      durationSeconds: Number,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "reserved", "charged", "refunded", "failed", "cancelled"],
      default: "unpaid",
    },

    logs: [String],
    modelUrl: String,
    errorMessage: String,
    completedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);