import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    jobId:    { type: mongoose.Schema.Types.ObjectId, ref: "Job",    required: true },
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },

    amount:      { type: Number, default: 0 },  // full tier price charged to user
    workerPay:   { type: Number, default: 0 },  // 80%
    platformFee: { type: Number, default: 0 },  // 20%

    durationSeconds: Number,

    // Docker stats snapshots (used for graphs — NOT for billing)
    cpu: { type: Number, default: 0 },
    ram: { type: Number, default: 0 },
    gpu: { type: Number, default: 0 },

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