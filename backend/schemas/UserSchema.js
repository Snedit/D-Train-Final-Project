import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["client", "worker-owner", "admin"], default: "client" },
    walletBalance: { type: Number, default: 0 },
    paymentMethods: [
      {
        type: { type: String },
        details: { type: Object },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
