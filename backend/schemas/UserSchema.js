import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ["client", "worker-owner", "admin"], default: "client" },

    // Total funds ever deposited (never decreases on spend)
    walletBalance: { type: Number, default: 0 },

    // Funds locked for pending/active jobs — cannot be spent elsewhere.
    // availableBalance = walletBalance - reservedBalance  (computed, not stored)
    reservedBalance: { type: Number, default: 0 },

    paymentMethods: [
      {
        type:    { type: String },
        details: { type: Object },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);