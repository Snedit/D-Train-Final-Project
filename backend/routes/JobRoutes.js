import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";
import Worker from "../schemas/WorkerSchema.js";
import multer from "multer";
import AdmZip from "adm-zip";
import { supabase } from "../utils/supabaseClient.js";
import redisPublisher from "../utils/redis.js";
import {
  calculateEstimatedCost,
  calculateActualCost,
  validateSufficientBalance,
  chargeFunds,
  creditWorkerWallet,
  getRealTimeCost
} from "../utils/paymentHelpers.js";
import { stopCostInterval } from './WorkerRoutes.js';
// ✅ reserveFunds + refundFunds removed — no pre-charging at any point

const JobRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

JobRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.userId });
    return res.status(200).json({ message: "jobs fetched", jobs });
  } catch (err) {
    return res.status(500).json({ message: "error fetching the jobs" });
  }
});

JobRouter.post("/create", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { mainFileName, title, description, estimatedDurationHours = 1 } = req.body;
    console.table(req.body);
    console.log(req.user);

    if (!req.file) return res.status(400).json({ message: "ZIP file is required." });
    if (!mainFileName) return res.status(400).json({ message: "mainFileName is required." });

    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries().map((e) => e.entryName);
    if (!entries.includes("requirements.txt"))
      return res.status(400).json({ message: "requirements.txt missing in ZIP." });
    if (!entries.includes(mainFileName))
      return res.status(400).json({ message: `Main file '${mainFileName}' not found.` });

    // Estimate cost for display only — wallet is NOT touched here
    const avgWorkerRate = 2.0;
    const estimatedCost = calculateEstimatedCost(avgWorkerRate, 'N/A', parseFloat(estimatedDurationHours), 0.05);

    // Only check balance — don't deduct
    const balanceCheck = await validateSufficientBalance(req.user.userId, estimatedCost);
    if (!balanceCheck.sufficient) {
      return res.status(400).json({ message: "Insufficient wallet balance", required: estimatedCost, available: balanceCheck.balance });
    }

    const filePath = `jobs/${Date.now()}-${req.file.originalname}`;
    const { data, error } = await supabase.storage.from("jobs").upload(filePath, req.file.buffer, { cacheControl: "3600", upsert: false });
    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Supabase upload failed." });
    }
    const { data: { publicUrl } } = supabase.storage.from("jobs").getPublicUrl(filePath);

    const job = await Job.create({
      userId: req.user.userId,
      config: { entryFile: mainFileName },
      zipFileUrl: publicUrl,
      status: "pending",
      title,
      description,
      logs: [],
      pricing: { estimatedCost },
      paymentStatus: "pending",
      createdAt: new Date(),
    });

    await redisPublisher.publish("new_job", JSON.stringify({ jobId: job._id, title, description }));

    res.status(201).json({ message: "Request submitted", jobId: job._id, success: true, estimatedCost, currency: "INR" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

JobRouter.get("/:jobId/status", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Unauthorized" });

    let realTimeCost = null;
    if ((job.status === "assigned" || job.status === "processing") && job.pricing?.startTime && job.pricing?.workerRate) {
      realTimeCost = getRealTimeCost(job.pricing.workerRate, job.pricing.gpuName || 'N/A', job.pricing.startTime, 0);
    }
    res.json({ ...job.toObject(), realTimeCost });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /:jobId/logs — returns pricing too so frontend can read fresh actualCost
JobRouter.get("/:jobId/logs", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Unauthorized" });

    res.json({
      logs: job.logs || [],
      status: job.status,
      pricing: job.pricing || {},   // ✅ frontend needs this to read actualCost for graphs
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

JobRouter.get("/:jobId/results", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ modelUrl: job.modelUrl, logsUrl: job.logsUrl, status: job.status });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

JobRouter.get("/:jobId/bill", authMiddleware, async (req, res) => {
  try {
    const bills = await Billing.find({ jobId: req.params.jobId });
    res.json({ total: bills.reduce((a, b) => a + b.amount, 0), breakdown: bills });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

JobRouter.get("/:jobId/cost", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Unauthorized" });
    if (!job.pricing?.startTime || !job.pricing?.workerRate) {
      return res.json({ currentCost: 0, elapsedSeconds: 0, status: job.status });
    }
    const costData = getRealTimeCost(job.pricing.workerRate, job.pricing.gpuName || 'N/A', job.pricing.startTime, 0);
    res.json({ ...costData, status: job.status, estimatedCost: job.pricing.estimatedCost });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /:jobId — no refund needed, nothing was charged
JobRouter.delete("/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Unauthorized - you can only delete your own jobs" });
    if (job.status !== "pending") return res.status(400).json({ message: `Cannot delete job with status '${job.status}'. Only pending jobs can be deleted.`, currentStatus: job.status, allowedStatus: "pending" });
    if (job.assignedWorkerId) return res.status(400).json({ message: "Cannot delete job that has been assigned to a worker" });

    await Job.findByIdAndDelete(req.params.jobId);
    console.log(`🗑️  Job ${req.params.jobId} deleted by user ${req.user.userId}`);
    res.status(200).json({ message: "Job deleted successfully", jobId: req.params.jobId });
  } catch (err) {
    res.status(500).json({ message: "Server error while deleting job", error: err.message });
  }
});

// DELETE /:jobId/cancel
JobRouter.delete("/:jobId/cancel", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId) return res.status(403).json({ message: "Unauthorized" });
    if (job.status !== "pending") return res.status(400).json({ message: "Cannot cancel active job" });

    job.status = "cancelled";
    job.paymentStatus = "cancelled";
    await job.save();
    res.json({ message: "Job cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /:jobId/complete — THIS is what the electron worker calls.
// This is the ONLY place money is cut — after training finishes and model is uploaded.
JobRouter.post("/:jobId/complete", upload.single("outputZip"), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId, logs } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId required" });
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.assignedWorkerId !== deviceId) return res.status(403).json({ message: "Unauthorized - this job is not assigned to this worker" });
    if (!req.file) return res.status(400).json({ message: "Output ZIP file required" });

    // ✅ Stop the backend cost broadcast interval immediately
    stopCostInterval(jobId.toString());
    console.log(`📦 Received output ZIP: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    const filePath = `outputs/job-${jobId}-${Date.now()}.zip`;
    const { error } = await supabase.storage.from("jobs").upload(filePath, req.file.buffer, { cacheControl: "3600", upsert: false, contentType: "application/zip" });
    if (error) return res.status(500).json({ message: "Failed to upload output files to storage", error: error.message });

    const { data: { publicUrl } } = supabase.storage.from("jobs").getPublicUrl(filePath);
    console.log(`✅ Output uploaded to: ${publicUrl}`);

    let parsedLogs = [];
    try { parsedLogs = logs ? JSON.parse(logs) : []; }
    catch { parsedLogs = [logs || "No logs provided"]; }

    // Calculate actual cost based on real duration
    const endTime = new Date();
    const startTime = job.pricing?.startTime || job.createdAt;
    // If workerRate or gpuName not saved on accept-job, fetch from worker directly
    let workerRate = job.pricing?.workerRate;
    let gpuName = job.pricing?.gpuName || 'N/A';
    if (!workerRate || gpuName === 'N/A') {
      const assignedWorker = await Worker.findOne({ deviceId });
      if (!workerRate) workerRate = assignedWorker?.pricing?.hourlyRate || 2.0;
      if (gpuName === 'N/A') gpuName = assignedWorker?.systemInfo?.gpu || 'N/A';
    }
    // No minimumCharge — charge exact real cost, never a fixed floor
    const { cost: actualCost, durationSeconds, gpuMultiplier, effectiveRate } = calculateActualCost(
      workerRate, gpuName, startTime, endTime
    );

    console.log(`💰 Job ${jobId} | GPU: ${gpuName} (×${gpuMultiplier}) | Rate: ₹${effectiveRate}/hr | Duration: ${durationSeconds}s | Cost: ₹${actualCost}`);

    // ✅ Charge user wallet — first and only time money is cut
    const chargeResult = await chargeFunds(job.userId, actualCost, jobId, null);
    if (!chargeResult.success) {
      console.error(`⚠️  Payment failed for job ${jobId}:`, chargeResult.error);
    }

    // Credit worker
    const worker = await Worker.findOne({ deviceId });
    if (worker) {
      await creditWorkerWallet(worker._id, actualCost, jobId);
      worker.totalJobsCompleted += 1;
      await worker.save();
      console.log(`💸 Credited ₹${actualCost} to worker ${worker.deviceId}`);
    }

    // Save billing snapshot
    await Billing.create({
      jobId: job._id,
      userId: job.userId,
      workerId: worker?._id,
      amount: actualCost,
      workerRate,
      durationSeconds,
      status: "paid",
      transactionId: chargeResult.transaction?._id,
    });

    // Save job
    job.status = "completed";
    job.modelUrl = publicUrl;
    job.logs = parsedLogs;
    job.completedAt = endTime;
    job.pricing = {
      ...job.pricing,
      actualCost,
      endTime,
      durationSeconds,
      gpuName,
      gpuMultiplier,
      effectiveRate,
    };
    job.paymentStatus = "charged";
    await job.save();

    // ✅ Emit job_completed WITH full pricing so frontend freezes cost ticker
    // and fetchHistoricalMetrics can read the correct actualCost
    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job_completed", {
        jobId: job._id,
        status: "completed",
        modelUrl: publicUrl,
        completedAt: job.completedAt,
        pricing: job.pricing,   // ← critical: frontend uses this to freeze cost
      });
      console.log(`📡 Emitted job_completed with pricing for ${jobId}`);
    }

    res.status(200).json({
      message: "Job completed successfully",
      job: { _id: job._id, title: job.title, status: job.status, modelUrl: job.modelUrl, completedAt: job.completedAt },
      outputUrl: publicUrl
    });
  } catch (err) {
    console.error("❌ Complete job error:", err);
    res.status(500).json({ message: "Server error while completing job", error: err.message });
  }
});

// POST /:jobId/fail — no refund, nothing was charged
JobRouter.post("/:jobId/fail", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId, errorMessage, logs } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId required" });
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.assignedWorkerId !== deviceId) return res.status(403).json({ message: "Unauthorized - this job is not assigned to this worker" });

    let parsedLogs = [];
    try { parsedLogs = logs ? JSON.parse(logs) : []; }
    catch { parsedLogs = [logs || "No logs provided"]; }

    // ✅ No refund needed — wallet was never touched before this point
    job.status = "failed";
    job.paymentStatus = "cancelled";
    job.errorMessage = errorMessage || "Job failed without error message";
    job.logs = parsedLogs;
    job.completedAt = new Date();
    job.pricing = { ...job.pricing, endTime: new Date() };
    await job.save();

    const worker = await Worker.findOne({ deviceId });
    if (worker && (job.pricing?.estimatedCost || 0) > 0) {
      worker.pendingEarnings = Math.max(0, worker.pendingEarnings - (job.pricing.estimatedCost || 0));
      await worker.save();
    }

    console.log(`❌ Job ${jobId} marked as failed: ${errorMessage}`);

    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job_failed", { jobId: job._id, status: "failed", errorMessage: job.errorMessage });
    }

    res.status(200).json({ message: "Job marked as failed", job: { _id: job._id, status: job.status, errorMessage: job.errorMessage } });
  } catch (err) {
    console.error("❌ Fail job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default JobRouter;