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
  reserveFunds,
  chargeFunds,
  refundFunds,
  getRealTimeCost
} from "../utils/paymentHelpers.js";

const JobRouter = Router();
const upload = multer({ storage: multer.memoryStorage() }); // handle zip upload

JobRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find({
      userId: req.user.userId
    });
    return res.status(200).json({ message: "jobs fetched", jobs })
  }
  catch (err) {
    console.log(err);
    return res.status(500).json({ messae: " error fetching the jobs" })
  }
});

JobRouter.post("/create", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { mainFileName, title, description, estimatedDurationHours = 1 } = req.body;
    console.table(req.body);
    console.log(req.user);
    if (!req.file)
      return res.status(400).json({ message: "ZIP file is required." });
    if (!mainFileName)
      return res.status(400).json({ message: "mainFileName is required." });

    // validate zip
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries().map((e) => e.entryName);

    if (!entries.includes("requirements.txt"))
      return res
        .status(400)
        .json({ message: "requirements.txt missing in ZIP." });

    if (!entries.includes(mainFileName))
      return res
        .status(400)
        .json({ message: `Main file '${mainFileName}' not found.` });

    // ✅ PAYMENT: Estimate cost based on average worker rate
    const avgWorkerRate = 0.10; // Default rate, can be calculated from active workers
    const estimatedCost = calculateEstimatedCost(avgWorkerRate, parseFloat(estimatedDurationHours), 0.05);

    // ✅ PAYMENT: Check wallet balance
    const balanceCheck = await validateSufficientBalance(req.user.userId, estimatedCost);
    if (!balanceCheck.sufficient) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        required: estimatedCost,
        available: balanceCheck.balance,
      });
    }

    // -----------------------------
    // 2. Upload ZIP to Supabase
    // -----------------------------
    const filePath = `jobs/${Date.now()}-${req.file.originalname}`;

    const { data, error } = await supabase.storage
      .from("jobs")
      .upload(filePath, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error(error);
      return res.status(500).json({ message: "Supabase upload failed." });
    }

    // Public link
    const {
      data: { publicUrl },
    } = supabase.storage.from("jobs").getPublicUrl(filePath);

    // -----------------------------
    // 3. Create Job in MongoDB
    // -----------------------------
    const job = await Job.create({
      userId: req.user.userId,
      config: { entryFile: mainFileName },
      zipFileUrl: publicUrl,
      status: "pending",
      title: title,
      description: description,
      logs: [],
      pricing: {
        estimatedCost: estimatedCost,
      },
      paymentStatus: "pending",
      createdAt: new Date(),
    });

    // -----------------------------
    // 4. Publish Redis Event
    // -----------------------------
    await redisPublisher.publish(
      "new_job",
      JSON.stringify({ jobId: job._id, title: title, description: description })
    );

    // -----------------------------
    // 5. Response
    // -----------------------------
    res.status(201).json({
      message: "Request submitted",
      jobId: job._id,
      estimatedCost: estimatedCost,
      currency: "INR",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

JobRouter.get("/:jobId/status", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    // ✅ PAYMENT: Include real-time cost if job is in progress
    let realTimeCost = null;
    if (job.status === "processing" && job.pricing?.startTime && job.pricing?.workerRate) {
      const costData = getRealTimeCost(job.pricing.workerRate, job.pricing.startTime, 0.05);
      realTimeCost = costData;
    }

    res.json({
      ...job.toObject(),
      realTimeCost,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ NEW: Get job logs endpoint for frontend
JobRouter.get("/:jobId/logs", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    res.json({
      logs: job.logs || [],
      status: job.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /:jobId/results
 * Returns model + logs
 */
JobRouter.get("/:jobId/results", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    res.json({
      modelUrl: job.modelUrl,
      logsUrl: job.logsUrl,
      status: job.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /:jobId/bill
 * Returns billing summary
 */
JobRouter.get("/:jobId/bill", authMiddleware, async (req, res) => {
  try {
    const bills = await Billing.find({ jobId: req.params.jobId });

    res.json({
      total: bills.reduce((a, b) => a + b.amount, 0),
      breakdown: bills,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /:jobId/cost
 * Get real-time cost for ongoing job
 */
JobRouter.get("/:jobId/cost", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    // If job is completed, return actual cost
    if (job.status === "completed") {
      return res.json({
        status: "completed",
        actualCost: job.pricing?.actualCost || 0,
        durationSeconds: job.pricing?.durationSeconds || 0,
        currency: "INR",
      });
    }

    // If job is in progress, calculate real-time cost
    if ((job.status === "assigned" || job.status === "processing") && job.pricing?.startTime) {
      const costData = getRealTimeCost(
        job.pricing.workerRate,
        job.pricing.startTime,
        0.05
      );

      return res.json({
        status: "in_progress",
        currentCost: costData.currentCost,
        elapsedSeconds: costData.elapsedSeconds,
        estimatedCost: job.pricing.estimatedCost,
        workerRate: job.pricing.workerRate,
        currency: "INR",
      });
    }

    // Job is pending or cancelled
    res.json({
      status: job.status,
      estimatedCost: job.pricing?.estimatedCost || 0,
      currency: "INR",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /:jobId
 * Delete a job (only if it's pending and not accepted/running)
 */
JobRouter.delete("/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    // Check if job exists
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check authorization
    if (job.userId.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Unauthorized - you can only delete your own jobs" });
    }

    // Check if job is in a deletable state
    if (job.status !== "pending") {
      return res.status(400).json({
        message: `Cannot delete job with status '${job.status}'. Only pending jobs can be deleted.`,
        currentStatus: job.status,
        allowedStatus: "pending"
      });
    }

    // Check if job has been assigned to a worker
    if (job.assignedWorkerId) {
      return res.status(400).json({
        message: "Cannot delete job that has been assigned to a worker",
        assignedWorkerId: job.assignedWorkerId
      });
    }

    // ✅ PAYMENT: Refund if funds were reserved
    if (job.paymentStatus === "reserved" && job.pricing?.estimatedCost) {
      const refundResult = await refundFunds(
        job.userId,
        job.pricing.estimatedCost,
        req.params.jobId
      );

      if (refundResult.success) {
        console.log(`💰 Refunded ₹${job.pricing.estimatedCost} for deleted job ${req.params.jobId}`);
      } else {
        console.warn(`⚠️  Refund failed for deleted job ${req.params.jobId}:`, refundResult.error);
      }
    }

    // Delete the job from database
    await Job.findByIdAndDelete(req.params.jobId);

    console.log(`🗑️  Job ${req.params.jobId} deleted by user ${req.user.userId}`);

    res.status(200).json({
      message: "Job deleted successfully",
      jobId: req.params.jobId
    });

  } catch (err) {
    console.error("❌ Delete job error:", err);
    res.status(500).json({
      message: "Server error while deleting job",
      error: err.message
    });
  }
});

/**
 * DELETE /:jobId/cancel
 * User cancels pending job
 */
JobRouter.delete("/:jobId/cancel", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    if (job.status !== "pending")
      return res.status(400).json({ message: "Cannot cancel active job" });

    // ✅ PAYMENT: Refund if funds were reserved
    if (job.paymentStatus === "reserved" && job.pricing?.estimatedCost) {
      const refundResult = await refundFunds(
        job.userId,
        job.pricing.estimatedCost,
        req.params.jobId
      );

      if (refundResult.success) {
        job.paymentStatus = "refunded";
        console.log(`💰 Refunded ₹${job.pricing.estimatedCost} for cancelled job`);
      }
    }

    job.status = "cancelled";
    await job.save();

    res.json({ message: "Job cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /:jobId/complete
 * Worker uploads output ZIP and logs to complete the job
 * No authMiddleware needed - worker uses deviceId verification
 */
JobRouter.post("/:jobId/complete", upload.single("outputZip"), async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId, logs } = req.body;

    console.log(`📥 Completing job ${jobId} from worker ${deviceId}`);

    // Validate required fields
    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

    // Find job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Verify this worker is assigned to this job
    if (job.assignedWorkerId !== deviceId) {
      return res.status(403).json({
        message: "Unauthorized - this job is not assigned to this worker"
      });
    }

    // Check if output ZIP was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "Output ZIP file required" });
    }

    console.log(`📦 Received ZIP: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);

    // Upload ZIP to Supabase
    const timestamp = Date.now();
    const filePath = `outputs/job-${jobId}-${timestamp}.zip`;

    const { data, error } = await supabase.storage
      .from("jobs")
      .upload(filePath, req.file.buffer, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/zip"
      });

    if (error) {
      console.error("❌ Supabase upload error:", error);
      return res.status(500).json({
        message: "Failed to upload output files to storage",
        error: error.message
      });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("jobs").getPublicUrl(filePath);

    console.log(`✅ Output uploaded to: ${publicUrl}`);

    // Parse logs (sent as JSON string)
    let parsedLogs = [];
    try {
      parsedLogs = logs ? JSON.parse(logs) : [];
    } catch (err) {
      console.warn("⚠️  Failed to parse logs, using raw:", err.message);
      parsedLogs = [logs || "No logs provided"];
    }

    // ✅ PAYMENT: Calculate actual cost and settle payment
    const endTime = new Date();
    const startTime = job.pricing?.startTime || job.createdAt;
    const workerRate = job.pricing?.workerRate || 0.10;
    const minimumCharge = 0.05;

    const { cost: actualCost, durationSeconds } = calculateActualCost(
      workerRate,
      startTime,
      endTime,
      minimumCharge
    );

    // Update job
    job.status = "completed";
    job.modelUrl = publicUrl; // Store ZIP URL
    job.logs = parsedLogs; // Store logs array
    job.completedAt = new Date();
    job.pricing = {
      ...job.pricing,
      actualCost,
      endTime,
      durationSeconds,
    };
    job.paymentStatus = "charged";
    await job.save();

    // ✅ PAYMENT: Charge user and pay worker
    const worker = await Worker.findOne({ deviceId });
    const chargeResult = await chargeFunds(
      job.userId,
      actualCost,
      jobId,
      worker?._id
    );

    if (!chargeResult.success) {
      console.error(`⚠️  Payment settlement failed for job ${jobId}:`, chargeResult.error);
    }

    // ✅ PAYMENT: Create billing record
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

    // ✅ PAYMENT: Update worker stats
    if (worker) {
      worker.totalJobsCompleted += 1;
      await worker.save();
    }

    console.log(`✅ Job ${jobId} marked as completed | Cost: ₹${actualCost} | Duration: ${durationSeconds}s`);

    // ✅ NEW: Emit completion event to frontend via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job_completed", {
        jobId: job._id,
        status: "completed",
        modelUrl: publicUrl,
        completedAt: job.completedAt
      });
      console.log(`📡 Emitted job_completed event for ${jobId}`);
    }

    res.status(200).json({
      message: "Job completed successfully",
      job: {
        _id: job._id,
        title: job.title,
        status: job.status,
        modelUrl: job.modelUrl,
        completedAt: job.completedAt
      },
      outputUrl: publicUrl
    });

  } catch (err) {
    console.error("❌ Complete job error:", err);
    res.status(500).json({
      message: "Server error while completing job",
      error: err.message
    });
  }
});

/**
 * POST /:jobId/fail
 * Worker reports job failure with error message
 */
JobRouter.post("/:jobId/fail", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId, errorMessage, logs } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Verify worker assignment
    if (job.assignedWorkerId !== deviceId) {
      return res.status(403).json({
        message: "Unauthorized - this job is not assigned to this worker"
      });
    }

    // Parse logs
    let parsedLogs = [];
    try {
      parsedLogs = logs ? JSON.parse(logs) : [];
    } catch (err) {
      parsedLogs = [logs || "No logs provided"];
    }

    // ✅ PAYMENT: Refund reserved funds on job failure
    const estimatedCost = job.pricing?.estimatedCost || 0;
    if (estimatedCost > 0 && job.paymentStatus === "reserved") {
      const refundResult = await refundFunds(job.userId, estimatedCost, jobId);
      if (refundResult.success) {
        job.paymentStatus = "refunded";
        console.log(`💰 Refunded ₹${estimatedCost} to user for failed job ${jobId}`);
      } else {
        console.error(`⚠️  Refund failed for job ${jobId}:`, refundResult.error);
      }
    }

    // Update job
    job.status = "failed";
    job.errorMessage = errorMessage || "Job failed without error message";
    job.logs = parsedLogs;
    job.completedAt = new Date();
    job.pricing = {
      ...job.pricing,
      endTime: new Date(),
    };
    await job.save();

    // ✅ PAYMENT: Update worker's pending earnings
    const worker = await Worker.findOne({ deviceId });
    if (worker && estimatedCost > 0) {
      worker.pendingEarnings -= estimatedCost;
      await worker.save();
    }

    console.log(`❌ Job ${jobId} marked as failed: ${errorMessage}`);

    // ✅ NEW: Emit failure event to frontend via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job_failed", {
        jobId: job._id,
        status: "failed",
        errorMessage: job.errorMessage
      });
      console.log(`📡 Emitted job_failed event for ${jobId}`);
    }

    res.status(200).json({
      message: "Job failure recorded",
      job: {
        _id: job._id,
        status: job.status,
        errorMessage: job.errorMessage
      }
    });

  } catch (err) {
    console.error("❌ Fail job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default JobRouter;