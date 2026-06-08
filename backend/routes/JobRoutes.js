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
  assignTierWithGroq,
  validateSufficientBalance,
  reserveFunds,
  releaseReservation,
  chargeFunds,
  creditWorkerWallet,
  workerEarnings,
  platformEarnings,
  hashRequirements,
  getElapsedSeconds,
} from "../utils/paymentHelpers.js";
import { stopCostInterval } from "./WorkerRoutes.js";

const JobRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── GET / — list user's jobs (includes drafts) ────────────────────────────────
JobRouter.get("/", authMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.status(200).json({ message: "jobs fetched", jobs });
  } catch {
    return res.status(500).json({ message: "error fetching the jobs" });
  }
});

// ── POST /create — upload zip, analyse with Groq, save as DRAFT ──────────────
// No payment, no reservation. Job is invisible to workers until published.
JobRouter.post("/create", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { mainFileName, title, description } = req.body;

    if (!req.file)            return res.status(400).json({ message: "ZIP file is required." });
    if (!mainFileName)        return res.status(400).json({ message: "mainFileName is required." });
    if (!title?.trim())       return res.status(400).json({ message: "Job title is required." });
    if (!description?.trim()) return res.status(400).json({ message: "Job description is required." });

    // ── 1. Validate ZIP ───────────────────────────────────────────────────────
    const zip     = new AdmZip(req.file.buffer);
    const entries = zip.getEntries().map((e) => e.entryName);

    if (!entries.includes("requirements.txt"))
      return res.status(400).json({ message: "requirements.txt missing in ZIP." });
    if (!entries.includes(mainFileName))
      return res.status(400).json({ message: `Main file '${mainFileName}' not found in ZIP.` });

    // ── 2. Read both files for Groq pricing ───────────────────────────────────
    const reqEntry    = zip.getEntry("requirements.txt");
    const mainEntry   = zip.getEntry(mainFileName);
    const requirementsTxt = reqEntry  ? reqEntry.getData().toString("utf8")  : "";
    const mainFileTxt     = mainEntry ? mainEntry.getData().toString("utf8") : "";

    // ── 3. Groq + rule-based pricing ──────────────────────────────────────────
    const tierPrice   = await assignTierWithGroq(requirementsTxt, mainFileTxt, mainFileName);
    const workerPay   = workerEarnings(tierPrice);
    const platformFee = platformEarnings(tierPrice);

    // ── 4. Upload ZIP to Supabase ─────────────────────────────────────────────
    const filePath = `jobs/${Date.now()}-${req.file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("jobs")
      .upload(filePath, req.file.buffer, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error(uploadError);
      return res.status(500).json({ message: "Supabase upload failed." });
    }

    const { data: { publicUrl } } = supabase.storage.from("jobs").getPublicUrl(filePath);

    // ── 5. Save as DRAFT — not visible to workers yet ─────────────────────────
    const job = await Job.create({
      userId:        req.user.userId,
      config:        { entryFile: mainFileName },
      zipFileUrl:    publicUrl,
      status:        "draft",          // ← key: invisible to workers
      paymentStatus: "unpaid",
      title,
      description,
      logs:          [],
      pricing:       { tierPrice, workerPay, platformFee },
    });

    console.log(`📝 Draft job ${job._id} created | Tier: ₹${tierPrice} | User: ${req.user.userId}`);

    res.status(201).json({
      message:  "Job saved as draft",
      jobId:    job._id,
      success:  true,
      isDraft:  true,
      tierPrice,
      currency: "INR",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /:jobId/publish — user pays and publishes draft to workers ────────────
// This is the "pay & submit" action on the dashboard draft card.
JobRouter.post("/:jobId/publish", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job)
      return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });
    if (job.status !== "draft")
      return res.status(400).json({ message: `Job is already ${job.status} — only drafts can be published.` });

    const tierPrice = job.pricing?.tierPrice;
    if (!tierPrice)
      return res.status(400).json({ message: "Job has no pricing. Please delete and re-upload." });

    // ── Balance check + reserve ───────────────────────────────────────────────
    const balanceCheck = await validateSufficientBalance(req.user.userId, tierPrice);
    if (!balanceCheck.sufficient) {
      return res.status(400).json({
        message:   `Insufficient balance. This job costs ₹${tierPrice}. You have ₹${balanceCheck.available?.toFixed(2)} available.`,
        tierPrice,
        required:  tierPrice,
        available: balanceCheck.available ?? 0,
        balance:   balanceCheck.balance ?? 0,
        reserved:  balanceCheck.reserved ?? 0,
        code:      "INSUFFICIENT_BALANCE",
      });
    }

    const reserveResult = await reserveFunds(req.user.userId, tierPrice, job._id);
    if (!reserveResult.success)
      return res.status(400).json({ message: `Reservation failed: ${reserveResult.error}`, code: "RESERVE_FAILED" });

    // ── Publish job — now visible to workers ──────────────────────────────────
    job.status        = "pending";
    job.paymentStatus = "reserved";
    await job.save();

    await redisPublisher.publish("new_job", JSON.stringify({
      jobId: job._id, title: job.title, description: job.description, tierPrice,
    }));

    console.log(`🚀 Job ${job._id} published | Tier: ₹${tierPrice} | Reserved ₹${tierPrice} from user ${req.user.userId}`);

    res.json({
      message:          "Job published successfully — workers can now see it",
      jobId:            job._id,
      status:           "pending",
      tierPrice,
      availableBalance: reserveResult.availableBalance,
    });
  } catch (err) {
    console.error("Publish error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── GET /:jobId/status ────────────────────────────────────────────────────────
JobRouter.get("/:jobId/status", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    let elapsedSeconds = null;
    if (["assigned", "processing"].includes(job.status) && job.pricing?.startTime)
      elapsedSeconds = getElapsedSeconds(job.pricing.startTime);

    res.json({ ...job.toObject(), elapsedSeconds });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /:jobId/logs ──────────────────────────────────────────────────────────
JobRouter.get("/:jobId/logs", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });
    res.json({ logs: job.logs || [], status: job.status, pricing: job.pricing || {} });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /:jobId/results ───────────────────────────────────────────────────────
JobRouter.get("/:jobId/results", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ modelUrl: job.modelUrl, logsUrl: job.logsUrl, status: job.status });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /:jobId/bill ──────────────────────────────────────────────────────────
JobRouter.get("/:jobId/bill", authMiddleware, async (req, res) => {
  try {
    const bills = await Billing.find({ jobId: req.params.jobId });
    res.json({ total: bills.reduce((a, b) => a + b.amount, 0), breakdown: bills });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /:jobId — delete draft or pending job ──────────────────────────────
JobRouter.delete("/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });
    if (!["draft", "pending"].includes(job.status))
      return res.status(400).json({ message: `Cannot delete job with status '${job.status}'.` });
    if (job.assignedWorkerId)
      return res.status(400).json({ message: "Cannot delete an assigned job." });

    // Release reservation if it was published (pending)
    if (job.status === "pending" && job.pricing?.tierPrice)
      await releaseReservation(job.userId, job.pricing.tierPrice, job._id);

    await Job.findByIdAndDelete(req.params.jobId);
    res.status(200).json({ message: "Job deleted successfully", jobId: req.params.jobId });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /:jobId/cancel ─────────────────────────────────────────────────────
JobRouter.delete("/:jobId/cancel", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });
    if (!["draft", "pending"].includes(job.status))
      return res.status(400).json({ message: "Can only cancel draft or pending jobs." });

    const tierPrice = job.pricing?.tierPrice;
    if (job.status === "pending" && tierPrice)
      await releaseReservation(job.userId, tierPrice, job._id);

    job.status        = "cancelled";
    job.paymentStatus = "cancelled";
    await job.save();
    res.json({ message: "Job cancelled" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// ── POST /:jobId/complete — worker uploads output, user is charged ─────────────
JobRouter.post("/:jobId/complete", upload.single("outputZip"), async (req, res) => {
  try {
    const { jobId }          = req.params;
    const { deviceId, logs } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId required" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.assignedWorkerId !== deviceId)
      return res.status(403).json({ message: "Unauthorized - job not assigned to this worker" });
    if (!req.file)
      return res.status(400).json({ message: "Output ZIP file required" });

    stopCostInterval(jobId.toString());

    const filePath = `outputs/job-${jobId}-${Date.now()}.zip`;
    const { error } = await supabase.storage
      .from("jobs")
      .upload(filePath, req.file.buffer, { cacheControl: "3600", upsert: false, contentType: "application/zip" });

    if (error) return res.status(500).json({ message: "Failed to upload output", error: error.message });

    const { data: { publicUrl } } = supabase.storage.from("jobs").getPublicUrl(filePath);

    let parsedLogs = [];
    try { parsedLogs = logs ? JSON.parse(logs) : []; }
    catch { parsedLogs = [logs || ""]; }

    const endTime         = new Date();
    const startTime       = job.pricing?.startTime || job.createdAt;
    const durationSeconds = Math.floor((endTime - new Date(startTime)) / 1000);
    const tierPrice       = job.pricing?.tierPrice ?? 30;
    const workerPay       = workerEarnings(tierPrice);
    const platformFee     = platformEarnings(tierPrice);

    const worker  = await Worker.findOne({ deviceId });
    const gpuName = worker?.systemInfo?.gpu || "N/A";

    const chargeResult = await chargeFunds(job.userId, tierPrice, jobId);
    if (!chargeResult.success) {
      job.status        = "failed";
      job.paymentStatus = "failed";
      job.errorMessage  = `Payment failed after training: ${chargeResult.error}`;
      await job.save();
      const io = req.app.get("io");
      io?.to(`job:${jobId}`).emit("job_failed", {
        jobId: job._id, status: "failed", errorMessage: job.errorMessage, paymentFailed: true,
      });
      return res.status(402).json({ message: "Payment failed", error: chargeResult.error });
    }

    if (worker) {
      await creditWorkerWallet(worker._id, workerPay, jobId);
      worker.totalJobsCompleted += 1;
      await worker.save();
    }

    await Billing.create({
      jobId: job._id, userId: job.userId, workerId: worker?._id,
      amount: tierPrice, workerPay, platformFee, durationSeconds,
      status: "paid", transactionId: chargeResult.transaction?._id,
    });

    job.status        = "completed";
    job.modelUrl      = publicUrl;
    job.logs          = parsedLogs;
    job.completedAt   = endTime;
    job.paymentStatus = "charged";
    job.pricing       = { ...job.pricing, tierPrice, workerPay, platformFee, actualCost: tierPrice, gpuName, startTime, endTime, durationSeconds };
    await job.save();

    const io = req.app.get("io");
    io?.to(`job:${jobId}`).emit("job_completed", {
      jobId: job._id, status: "completed", modelUrl: publicUrl, completedAt: job.completedAt, pricing: job.pricing,
    });

    res.status(200).json({ message: "Job completed", outputUrl: publicUrl });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ── POST /:jobId/fail ─────────────────────────────────────────────────────────
JobRouter.post("/:jobId/fail", async (req, res) => {
  try {
    const { jobId }                        = req.params;
    const { deviceId, errorMessage, logs } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId required" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.assignedWorkerId !== deviceId)
      return res.status(403).json({ message: "Unauthorized" });

    let parsedLogs = [];
    try { parsedLogs = logs ? JSON.parse(logs) : []; }
    catch { parsedLogs = []; }

    const tierPrice = job.pricing?.tierPrice;
    if (tierPrice) await releaseReservation(job.userId, tierPrice, jobId);

    job.status        = "failed";
    job.paymentStatus = "cancelled";
    job.errorMessage  = errorMessage || "Job failed";
    job.logs          = parsedLogs;
    job.completedAt   = new Date();
    job.pricing       = { ...job.pricing, endTime: new Date() };
    await job.save();

    const io = req.app.get("io");
    io?.to(`job:${jobId}`).emit("job_failed", { jobId: job._id, status: "failed", errorMessage: job.errorMessage });

    res.status(200).json({ message: "Job marked as failed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default JobRouter;