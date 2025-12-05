import mongoose from "mongoose";

const usageSchema = new mongoose.Schema({
  time: Number,
  value: Number,
});

const jobMetricsSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },

    cpuUsage: [usageSchema],
    gpuUsage: [usageSchema],
    ramUsage: [usageSchema],

    durationMs: Number,
    totalComputeScore: Number,
    calculatedCost: Number,
  },
  { timestamps: true }
);

export default mongoose.model("JobMetrics", jobMetricsSchema);
