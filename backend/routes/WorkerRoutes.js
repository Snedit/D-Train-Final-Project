import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";
import { supabase } from "../utils/supabaseClient.js";
import AdmZip from "adm-zip";
import {
  calculateEstimatedCost,
  calculateActualCost,
  chargeFunds,
  creditWorkerWallet,
  getRealTimeCost
} from "../utils/paymentHelpers.js";
// ✅ reserveFunds removed — no pre-charging anywhere

const WorkerRouter = Router();
const jobCostIntervals = new Map();

const startCostInterval = (io, jobId, workerRate, gpuName, startTime) => {
  if (jobCostIntervals.has(jobId)) clearInterval(jobCostIntervals.get(jobId));
  const interval = setInterval(() => {
    // ✅ minimumCharge=0 so cost ramps smoothly from ₹0 — no 0.05 floor during broadcast
    const { currentCost, elapsedSeconds, gpuMultiplier, effectiveRate } = getRealTimeCost(
      workerRate, gpuName || "N/A", startTime, 0
    );
    io.to(`job:${jobId}`).emit("job:cost_update", {
      jobId, currentCost, elapsedSeconds, gpuMultiplier, effectiveRate,
    });
  }, 1000);
  jobCostIntervals.set(jobId, interval);
  console.log(`⏱️  Cost interval started | job:${jobId} | GPU:${gpuName} | ₹${workerRate}/hr`);
};

export const stopCostInterval = (jobId) => {
  if (jobCostIntervals.has(jobId)) {
    clearInterval(jobCostIntervals.get(jobId));
    jobCostIntervals.delete(jobId);
    console.log(`⏹️  Cost interval stopped | job:${jobId}`);
  }
};

const emitWorkerOnline = (io, worker) => {
  if (!io) return;
  io.emit("worker_status_changed", {
    workerId: worker._id,
    deviceId: worker.deviceId,
    status: "online",
    timestamp: new Date().toISOString()
  });
};

WorkerRouter.get("/", authMiddleware, async (req, res) => {
  try {
    const workers = await Worker.find();
    return res.status(200).json({ message: "workers available", workers });
  } catch (error) {
    return res.status(500).json({ message: "error fetching workers" });
  }
});

WorkerRouter.get("/available-jobs", async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (deviceId) {
      const worker = await Worker.findOne({ deviceId });
      if (!worker) return res.status(404).json({ message: "Worker not registered. Please register first." });
      const wasOffline = worker.currentStatus === "offline";
      worker.lastHeartbeatAt = Date.now();
      worker.currentStatus = "online";
      await worker.save();
      if (wasOffline) emitWorkerOnline(req.app.get("io"), worker);
    }
    const availableJobs = await Job.find({
      status: { $in: ['pending', 'queued'] },
      $or: [{ assignedWorkerId: { $exists: false } }, { assignedWorkerId: null }, { assignedWorkerId: '' }]
    }).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json({ message: "Available jobs fetched successfully", jobs: availableJobs, availableJobs, count: availableJobs.length });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching available jobs", error: error.message });
  }
});

WorkerRouter.post("/register", authMiddleware, async (req, res) => {
  try {
    const { deviceId, os, cpu, ram, gpu } = req.body;
    if (!deviceId) return res.status(400).json({ message: "deviceId required" });
    const worker = await Worker.findOneAndUpdate(
      { deviceId },
      { userId: req.user.userId, deviceId, systemInfo: { os: os || "Unknown", cpu: cpu || "Unknown", ram: ram || "Unknown", gpu: gpu || "N/A" }, currentStatus: "online", lastHeartbeatAt: Date.now() },
      { upsert: true, new: true }
    );
    emitWorkerOnline(req.app.get("io"), worker);
    res.status(201).json({ message: "Worker registered successfully", worker });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.post("/metrics", async (req, res) => {
  try {
    const { jobId, deviceId, cpu, ram, gpu, durationMs, timestamp } = req.body;
    console.log(`[Metrics] Received | job=${jobId} | cpu=${cpu} ram=${ram} gpu=${gpu}`);
    const job = await Job.findById(jobId).select("userId pricing").lean();
    if (!job) console.warn(`[Metrics] Job ${jobId} not found in DB`);

    // ✅ Look up worker _id (ObjectId) from deviceId string — BillingSchema.workerId is ObjectId
    const worker = await Worker.findOne({ deviceId }).select("_id").lean();

    await Billing.create({
      userId: job?.userId || null,
      jobId,
      workerId: worker?._id || null,   // ✅ ObjectId, not the deviceId string
      amount: 0,
      workerRate: job?.pricing?.workerRate || 2.0,
      durationSeconds: Math.round((parseFloat(durationMs) || 0) / 1000),
      cpu: parseFloat(cpu) || 0,
      ram: parseFloat(ram) || 0,
      gpu: parseFloat(gpu) || 0,
    });
    const io = req.app.get("io");
    if (io && jobId) {
      const cpuVal = parseFloat(cpu) || 0;
      const memVal = parseFloat(ram) || 0;
      io.to(`job:${jobId}`).emit("job:metrics_update", {
        jobId,
        cpu: cpuVal,
        memory: memVal,
        gpu: parseFloat(gpu) || 0,
        timestamp: timestamp || new Date().toISOString(),
      });
      console.log(`[Metrics] Emitted job:metrics_update to room job:${jobId} | cpu=${cpuVal} mem=${memVal}`);
    }
    res.json({ message: "Metrics logged" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /complete — fallback for non-electron workers (electron uses POST /api/jobs/:id/complete)
// If you only use the electron worker, this route is unused but kept for compatibility.
WorkerRouter.post("/complete", async (req, res) => {
  try {
    const { jobId, modelUrl, logsUrl } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    stopCostInterval(jobId.toString());

    const startTime = job.pricing?.startTime || job.createdAt;
    const endTime = new Date();
    const workerRate = job.pricing?.workerRate || 2.0;
    let gpuName = job.pricing?.gpuName || "N/A";
    if (gpuName === "N/A" && job.assignedWorkerId) {
      const assignedWorker = await Worker.findOne({ deviceId: job.assignedWorkerId }).select("systemInfo").lean();
      if (assignedWorker?.systemInfo?.gpu) gpuName = assignedWorker.systemInfo.gpu;
    }

    const { cost: actualCost, durationSeconds, gpuMultiplier, effectiveRate } = calculateActualCost(
      workerRate, gpuName, startTime, endTime, 0.05
    );

    const chargeResult = await chargeFunds(job.userId, actualCost, jobId, null);
    if (!chargeResult.success) console.error(`⚠️  Payment failed for job ${jobId}:`, chargeResult.error);

    if (job.assignedWorkerId) {
      const worker = await Worker.findOne({ deviceId: job.assignedWorkerId });
      if (worker) {
        await creditWorkerWallet(worker._id, actualCost, jobId);
        worker.totalJobsCompleted += 1;
        await worker.save();
      }
    }

    job.status = "completed";
    job.modelUrl = modelUrl;
    job.logsUrl = logsUrl;
    job.completedAt = endTime;
    job.pricing = { ...job.pricing, actualCost, endTime, durationSeconds, gpuName, gpuMultiplier, effectiveRate };
    job.paymentStatus = "charged";
    await job.save();

    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job_completed", {
        jobId: job._id, modelUrl, status: "completed", pricing: job.pricing,
      });
    }

    res.json({ message: "Job completed and payment processed", job, payment: { cost: actualCost, duration: durationSeconds } });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.post("/push-log", async (req, res) => {
  try {
    const { jobId, deviceId, line } = req.body;
    if (!jobId || !deviceId || !line) return res.status(400).json({ message: "jobId, deviceId and line required" });
    const job = await Job.findByIdAndUpdate(jobId, { $push: { logs: line } }, { new: true });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const io = req.app.get("io");
    if (io) io.to(`job:${jobId}`).emit("job:log", { jobId, line, timestamp: new Date().toISOString() });
    res.json({ message: "Log streamed" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

WorkerRouter.post("/heartbeat", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ message: "deviceId missing" });
    const worker = await Worker.findOne({ deviceId });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    const wasOffline = worker.currentStatus === "offline";
    worker.lastHeartbeatAt = Date.now();
    worker.currentStatus = "online";
    await worker.save();
    if (wasOffline) emitWorkerOnline(req.app.get("io"), worker);
    res.json({ message: "Heartbeat received" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /accept-job — assigns job + starts cost ticker for display only, NO money cut
WorkerRouter.post("/accept-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;
    console.log(`📥 Worker ${deviceId} attempting to accept job ${jobId}`);

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "pending" && job.status !== "queued") {
      return res.status(400).json({ message: "Job already taken", currentStatus: job.status });
    }

    const worker = await Worker.findOne({ deviceId });
    if (!worker) return res.status(404).json({ message: "Worker not found. Please register first." });

    const workerRate = worker.pricing.hourlyRate;
    const minimumCharge = worker.pricing.minimumCharge;
    const gpuName = worker.systemInfo?.gpu || "N/A";

    // Estimate for display only — nothing deducted
    const estimatedEpochs = job.config?.epochs || 1;
    const estimatedDurationHours = Math.max((estimatedEpochs * 6) / 60, 0.1);
    const estimatedCost = job.pricing?.estimatedCost
      || calculateEstimatedCost(workerRate, gpuName, estimatedDurationHours, minimumCharge);

    const startTime = new Date();
    job.status = "assigned";
    job.assignedWorkerId = deviceId;
    job.pricing = { ...job.pricing, workerRate, estimatedCost, gpuName, startTime };
    job.paymentStatus = "pending"; // still pending — nothing charged yet
    await job.save();

    console.log(`✅ Job ${jobId} assigned to ${deviceId} | GPU: ${gpuName} | Estimated: ₹${estimatedCost} (not charged)`);

    const io = req.app.get("io");
    // ✅ No startCostInterval here — cost ticker starts only when worker clicks Start
    // and calls POST /api/worker/start-job, not at accept time

    io.emit("job_status_changed", { jobId: job._id, status: "assigned", assignedWorkerId: deviceId, timestamp: new Date().toISOString() });
    io.to(`job:${jobId}`).emit("job_accepted", { jobId: job._id, workerId: deviceId, status: "assigned", pricing: job.pricing });

    res.json({
      message: "Job accepted",
      job: { _id: job._id, title: job.title, status: job.status, assignedWorkerId: job.assignedWorkerId, pricing: job.pricing, paymentStatus: job.paymentStatus }
    });
  } catch (err) {
    console.error("❌ Accept job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ POST /start-job — called by electron worker when Start button is clicked
// This is the real moment the cost clock begins for the user
WorkerRouter.post("/start-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;
    if (!jobId || !deviceId) return res.status(400).json({ message: "jobId and deviceId required" });

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.assignedWorkerId !== deviceId) return res.status(403).json({ message: "Unauthorized" });

    const worker = await Worker.findOne({ deviceId });
    const workerRate = job.pricing?.workerRate || worker?.pricing?.hourlyRate || 2.0;
    const gpuName = job.pricing?.gpuName || worker?.systemInfo?.gpu || "N/A";

    // ✅ Record the real startTime — now, when training actually begins
    const startTime = new Date();
    job.pricing = { ...job.pricing, startTime, workerRate, gpuName };
    job.status = "processing";
    await job.save();

    const io = req.app.get("io");
    // Start broadcasting cost to the user's JobDetail page
    startCostInterval(io, jobId.toString(), workerRate, gpuName, startTime);

    // Tell the frontend the real startTime so its local ticker is also correct
    io.to(`job:${jobId}`).emit("job:started", {
      jobId: job._id,
      startTime: startTime.toISOString(),
      workerRate,
      gpuName,
    });

    io.emit("job_status_changed", { jobId: job._id, status: "processing", timestamp: new Date().toISOString() });

    console.log(`▶️  Job ${jobId} STARTED by worker ${deviceId} | GPU: ${gpuName} | Rate: ₹${workerRate}/hr`);
    res.json({ message: "Job started", startTime });
  } catch (err) {
    console.error("start-job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.get("/my-worker", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "No worker found for this user" });
    res.status(200).json({ message: "Worker found", worker });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.get("/job/:jobId/details", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId } = req.query;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (deviceId && (job.status === 'assigned' || job.status === 'completed') && job.assignedWorkerId !== deviceId)
      return res.status(403).json({ message: "Unauthorized - job not assigned to this worker" });

    let zipMetadata = null, zipFilesList = [], filesExtractedFromZip = false;
    if (job.zipFileUrl) {
      try {
        const urlParts = job.zipFileUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `jobs/${fileName}`;
        const { data: fileData, error: fileError } = await supabase.storage.from("jobs").list("jobs", { limit: 100, offset: 0 });
        if (!fileError && fileData) {
          const fileInfo = fileData.find((f) => f.name === fileName);
          if (fileInfo) zipMetadata = { name: fileInfo.name, size: fileInfo.metadata?.size || 0, createdAt: fileInfo.created_at, lastModified: fileInfo.updated_at };
        }
        try {
          const { data: zipData, error: downloadError } = await supabase.storage.from("jobs").download(filePath);
          if (!downloadError && zipData) {
            const buffer = Buffer.from(await zipData.arrayBuffer());
            const zip = new AdmZip(buffer);
            zipFilesList = zip.getEntries().filter(e => !e.isDirectory).map(entry => {
              const fn = entry.entryName;
              let fileType = "File", required = false;
              if (fn === "requirements.txt") { fileType = "Dependencies"; required = true; }
              else if (fn === job.config.entryFile) { fileType = "Entry Point"; required = true; }
              else if (fn.endsWith(".py")) fileType = "Python Script";
              else if (fn.includes("dataset") || fn.includes("data")) fileType = "Training Data";
              else if (fn.endsWith(".txt")) fileType = "Text File";
              else if (fn.endsWith(".json")) fileType = "Configuration";
              else if (fn.endsWith(".csv")) fileType = "Dataset";
              return { name: fn, type: fileType, required, size: entry.header.size };
            });
            filesExtractedFromZip = true;
          }
        } catch {
          zipFilesList = [{ name: "requirements.txt", type: "Dependencies", required: true }, { name: job.config.entryFile || "main.py", type: "Entry Point", required: true }];
        }
      } catch {
        zipFilesList = [{ name: "requirements.txt", type: "Dependencies", required: true }, { name: job.config.entryFile || "main.py", type: "Entry Point", required: true }];
      }
    }

    res.status(200).json({
      message: "Job details fetched successfully",
      job: { _id: job._id, userId: job.userId, title: job.title, description: job.description, status: job.status, zipFileUrl: job.zipFileUrl, config: job.config, assignedWorkerId: job.assignedWorkerId, logs: job.logs, modelUrl: job.modelUrl, errorMessage: job.errorMessage, createdAt: job.createdAt, updatedAt: job.updatedAt },
      zipMetadata, zipFilesList, filesExtractedFromZip,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.put("/pricing", authMiddleware, async (req, res) => {
  try {
    const { hourlyRate, minimumCharge } = req.body;
    if (hourlyRate !== undefined && (hourlyRate < 0 || hourlyRate > 1000)) return res.status(400).json({ message: "Invalid hourly rate" });
    if (minimumCharge !== undefined && (minimumCharge < 0 || minimumCharge > 100)) return res.status(400).json({ message: "Invalid minimum charge" });
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "Worker not found. Please register first." });
    if (hourlyRate !== undefined) worker.pricing.hourlyRate = hourlyRate;
    if (minimumCharge !== undefined) worker.pricing.minimumCharge = minimumCharge;
    await worker.save();
    res.json({ message: "Pricing updated successfully", pricing: worker.pricing });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.get("/pricing", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json({ pricing: worker.pricing, totalEarnings: worker.totalEarnings, pendingEarnings: worker.pendingEarnings });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.get("/earnings", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    const completedJobs = await Job.find({ assignedWorkerId: worker.deviceId, status: "completed" }).select("title pricing createdAt");
    const inProgressJobs = await Job.find({ assignedWorkerId: worker.deviceId, status: { $in: ["assigned", "processing"] } }).select("title pricing createdAt");
    res.json({
      totalEarnings: worker.totalEarnings, pendingEarnings: worker.pendingEarnings,
      walletBalance: worker.walletBalance, totalJobsCompleted: worker.totalJobsCompleted, pricing: worker.pricing,
      completedJobs: completedJobs.map(j => ({ id: j._id, title: j.title, earnings: j.pricing?.actualCost || 0, completedAt: j.createdAt })),
      inProgressJobs: inProgressJobs.map(j => ({ id: j._id, title: j.title, estimatedEarnings: j.pricing?.estimatedCost || 0, startedAt: j.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

WorkerRouter.get("/wallet", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    const Transaction = (await import("../schemas/TransactionSchema.js")).default;
    const transactions = await Transaction.find({ workerId: worker._id }).sort({ createdAt: -1 }).limit(50).populate("jobId", "title");
    res.json({
      walletBalance: worker.walletBalance, totalEarnings: worker.totalEarnings, pendingEarnings: worker.pendingEarnings,
      transactions: transactions.map(tx => ({ id: tx._id, type: tx.type, amount: tx.amount, status: tx.status, description: tx.description, jobTitle: tx.jobId?.title || "N/A", createdAt: tx.createdAt })),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default WorkerRouter;