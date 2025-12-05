import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },

    amount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    invoiceUrl: String,
  },
  { timestamps: true }
);

export default mongoose.model("Billing", billingSchema);
