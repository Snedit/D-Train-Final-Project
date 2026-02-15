import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },

    amount: { type: Number, required: true },

    // Pricing details
    workerRate: { type: Number, required: true }, // Rate at time of job
    durationSeconds: Number, // Execution duration

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    // Reference to transaction
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

    invoiceUrl: String,
  },
  { timestamps: true }
);

export default mongoose.model("Billing", billingSchema);
