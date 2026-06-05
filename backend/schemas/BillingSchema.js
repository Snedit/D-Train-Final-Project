import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },

    amount: { type: Number, default: 0 },

    // Pricing details
    workerRate: { type: Number, default: 0 },
    durationSeconds: Number,

    // Real-time docker stats snapshot at time of recording
    cpu: { type: Number, default: 0 },   // CPU %
    ram: { type: Number, default: 0 },   // Memory %
    gpu: { type: Number, default: 0 },   // GPU % (0 unless nvidia-smi available)

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    invoiceUrl: String,
  },
  { timestamps: true }
);

export default mongoose.model("Billing", billingSchema);