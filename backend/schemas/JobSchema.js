import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title: String,
    description: String,

    zipFileUrl: { type: String, required: true },

    config: {
      entryFile: String,
      requirementsFile: String,
      epochs: Number,
      datasetSize: Number,
      other: Object,
    },

    assignedWorkerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker" },

    status: {
      type: String,
      enum: ["queued", "assigned", "processing", "completed", "failed", "cancelled"],
      default: "queued",
    },

    logs: [String],
    modelUrl: String,
    errorMessage: String,
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
