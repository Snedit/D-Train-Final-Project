import mongoose from "mongoose";

// A "quote" is created when the user selects a zip file on the submission page.
// The frontend extracts requirements.txt and sends it to POST /api/jobs/estimate.
// Groq analyses it ONCE and returns a quoteId + tierPrice.
// When the user actually submits the job, they pass quoteId — we use the
// stored tier price instead of calling Groq again. This guarantees the price
// never changes between "I need ₹30" and the actual upload.

const quoteSchema = new mongoose.Schema(
  {
    quoteId:    { type: String, required: true, unique: true, index: true },
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    tierPrice:   { type: Number, required: true },
    workerPay:   { type: Number, required: true },   // 80%
    platformFee: { type: Number, required: true },   // 20%

    // Hash of requirements.txt contents so we can detect if the user swapped
    // the zip between estimate and submit (different file = new quote needed).
    requirementsHash: { type: String, required: true },

    used:      { type: Boolean, default: false },   // true once job is created
    expiresAt: { type: Date,    required: true },   // 30 minutes from creation
  },
  { timestamps: true }
);

// Auto-delete expired quotes from MongoDB
quoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Quote", quoteSchema);