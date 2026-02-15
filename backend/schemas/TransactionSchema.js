import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    type: {
      type: String,
      enum: ["topup", "reservation", "charge", "refund", "withdrawal"],
      required: true,
    },
    
    amount: { type: Number, required: true },
    
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },
    
    // Related job (if applicable)
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    
    // Razorpay payment details
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    
    // Description for transaction history
    description: String,
    
    // Metadata
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ razorpayOrderId: 1 });
transactionSchema.index({ razorpayPaymentId: 1 });

export default mongoose.model("Transaction", transactionSchema);
