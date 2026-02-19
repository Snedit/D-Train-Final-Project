import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";
import { supabase } from "../utils/supabaseClient.js";
import AdmZip from "adm-zip";
import { calculateEstimatedCost, reserveFunds, calculateActualCost, chargeFunds, creditWorkerWallet } from "../utils/paymentHelpers.js";

const WorkerRouter = Router();

// ✅ HELPER: Emit worker online status change if worker was previously offline
// Call this anywhere a worker proves it's alive (heartbeat, register, available-jobs poll)
const emitWorkerOnline = (io, worker) => {
  if (!io) return;
  io.emit("worker_status_changed", {
    workerId: worker._id,
    deviceId: worker.deviceId,
    status: "online",
    timestamp: new Date().toISOString()
  });
  console.log(`📡 Emitted worker online: ${worker.deviceId}`);
};

// GET / - Fetch all workers (admin endpoint)
WorkerRouter.get("/", authMiddleware, async (req, res) => {
  try {
    const workers = await Worker.find();
    return res.status(200).json({ message: "workers available", workers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "error fetching workers" });
  }
});

// ✅ GET /available-jobs - Worker polls for jobs (also acts as a lightweight heartbeat)
WorkerRouter.get("/available-jobs", async (req, res) => {
  try {
    const { deviceId } = req.query;

    console.log("Fetching available jobs for worker:", deviceId);

    if (deviceId) {
      const worker = await Worker.findOne({ deviceId });
      if (!worker) {
        return res.status(404).json({
          message: "Worker not registered. Please register first."
        });
      }

      const wasOffline = worker.currentStatus === "offline";

      worker.lastHeartbeatAt = Date.now();
      worker.currentStatus = "online";
      await worker.save();

      // ✅ If worker was offline, emit online event so user UI updates instantly
      if (wasOffline) {
        const io = req.app.get("io");
        emitWorkerOnline(io, worker);
      }
    }

    const availableJobs = await Job.find({
      status: { $in: ['pending', 'queued'] },
      $or: [
        { assignedWorkerId: { $exists: false } },
        { assignedWorkerId: null },
        { assignedWorkerId: '' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`Found ${availableJobs.length} available jobs`);

    return res.status(200).json({
      message: "Available jobs fetched successfully",
      jobs: availableJobs,
      availableJobs: availableJobs,
      count: availableJobs.length
    });
  } catch (error) {
    console.error("Error fetching available jobs:", error);
    return res.status(500).json({
      message: "Error fetching available jobs",
      error: error.message
    });
  }
});

// ✅ POST /register - Worker registration
WorkerRouter.post("/register", authMiddleware, async (req, res) => {
  try {
    const { deviceId, os, cpu, ram, gpu } = req.body;

    console.log("Registration request:", { deviceId, os, cpu, ram, gpu });
    console.log("Authenticated user:", req.user.userId);

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

    // Check if worker existed and was offline before upserting
    const existingWorker = await Worker.findOne({ deviceId });
    const wasOffline = existingWorker?.currentStatus === "offline";

    const worker = await Worker.findOneAndUpdate(
      { deviceId },
      {
        userId: req.user.userId,
        deviceId,
        systemInfo: {
          os: os || "Unknown",
          cpu: cpu || "Unknown",
          ram: ram || "Unknown",
          gpu: gpu || "N/A",
        },
        currentStatus: "online",
        lastHeartbeatAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    console.log("Worker created/updated:", worker);

    // ✅ Emit online event so user UI updates instantly on registration
    const io = req.app.get("io");
    emitWorkerOnline(io, worker);

    res.status(201).json({
      message: "Worker registered successfully",
      worker,
    });
  } catch (err) {
    console.error("Worker registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /metrics - Worker reports usage
WorkerRouter.post("/metrics", async (req, res) => {
  try {
    const { jobId, deviceId, cpu, ram, gpu, durationMs } = req.body;

    await Billing.create({
      userId: null,
      jobId,
      workerId: deviceId,
      cpu,
      ram,
      gpu,
      durationMs,
    });

    res.json({ message: "Metrics logged" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /complete - Worker uploads final model
WorkerRouter.post("/complete", async (req, res) => {
  try {
    const { jobId, modelUrl, logsUrl } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    const startTime = job.pricing.startTime || job.createdAt;
    const endTime = new Date();
    const workerRate = job.pricing.workerRate || 0.10;

    const { cost: actualCost, durationSeconds } = calculateActualCost(
      workerRate,
      startTime,
      endTime,
      0.05
    );

    console.log(`💰 Job ${jobId} completed. Cost: ₹${actualCost} (${durationSeconds}s)`);

    await chargeFunds(job.userId, actualCost, jobId, null);

    if (job.assignedWorkerId) {
      const worker = await Worker.findOne({ deviceId: job.assignedWorkerId });
      if (worker) {
        await creditWorkerWallet(worker._id, actualCost, jobId);
        console.log(`💸 Credited ₹${actualCost} to worker ${worker.deviceId}`);
      }
    }

    job.status = "completed";
    job.modelUrl = modelUrl;
    job.logsUrl = logsUrl;
    job.completedAt = endTime;
    job.pricing.actualCost = actualCost;
    job.pricing.endTime = endTime;
    job.pricing.durationSeconds = durationSeconds;
    job.paymentStatus = "charged";

    await job.save();

    res.json({
      message: "Job marked completed and payment processed",
      job,
      payment: { cost: actualCost, duration: durationSeconds }
    });
  } catch (err) {
    console.error("Job completion error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ POST /push-log - Stream logs with Socket.IO
WorkerRouter.post("/push-log", async (req, res) => {
  try {
    const { jobId, deviceId, line } = req.body;

    if (!jobId || !deviceId || !line) {
      return res.status(400).json({
        message: "jobId, deviceId and line required",
      });
    }

    const job = await Job.findByIdAndUpdate(
      jobId,
      { $push: { logs: line } },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`job:${jobId}`).emit("job:log", {
        jobId,
        line,
        timestamp: new Date().toISOString()
      });
      console.log(`📡 Log streamed for job ${jobId.slice(-8)}: ${line.substring(0, 50)}...`);
    }

    res.json({ message: "Log streamed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /heartbeat - Worker heartbeat — emits online event if worker was offline
WorkerRouter.post("/heartbeat", async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId missing" });
    }

    // Find current status before updating so we know if this is a transition
    const worker = await Worker.findOne({ deviceId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const wasOffline = worker.currentStatus === "offline";

    worker.lastHeartbeatAt = Date.now();
    worker.currentStatus = "online";
    await worker.save();

    // ✅ If worker was offline, emit online event so user UI updates instantly
    // This is the key fix: reconnecting worker sends a heartbeat, which triggers
    // an immediate socket broadcast so the user dashboard refreshes without polling
    if (wasOffline) {
      const io = req.app.get("io");
      emitWorkerOnline(io, worker);
    }

    res.json({ message: "Heartbeat received" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /accept-job - Worker accepts a job
WorkerRouter.post("/accept-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;

    console.log(`📥 Worker ${deviceId} attempting to accept job ${jobId}`);

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.status !== "pending" && job.status !== "queued") {
      console.log(`❌ Job ${jobId} already taken. Status: ${job.status}`);
      return res.status(400).json({
        message: "Job already taken",
        currentStatus: job.status
      });
    }

    const worker = await Worker.findOne({ deviceId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found. Please register first." });
    }

    const workerRate = worker.pricing.hourlyRate;
    const minimumCharge = worker.pricing.minimumCharge;

    const estimatedCost = job.pricing?.estimatedCost || calculateEstimatedCost(workerRate, 1, minimumCharge);
    const reserveResult = await reserveFunds(job.userId, estimatedCost, jobId);

    if (!reserveResult.success) {
      return res.status(400).json({
        message: "Failed to reserve funds",
        error: reserveResult.error
      });
    }

    job.status = "assigned";
    job.assignedWorkerId = deviceId;
    job.pricing = {
      ...job.pricing,
      workerRate: workerRate,
      estimatedCost: estimatedCost,
      startTime: new Date(),
    };
    job.paymentStatus = "reserved";
    await job.save();

    worker.pendingEarnings += estimatedCost;
    await worker.save();

    console.log(`✅ Job ${jobId} assigned to worker ${deviceId} | Reserved: ₹${estimatedCost}`);

    const io = req.app.get("io");

    io.emit("job_status_changed", {
      jobId: job._id,
      status: "assigned",
      assignedWorkerId: deviceId,
      timestamp: new Date().toISOString()
    });

    io.to(`job:${jobId}`).emit("job_accepted", {
      jobId: job._id,
      workerId: deviceId,
      status: "assigned",
      pricing: job.pricing,
    });

    console.log(`📡 Socket events emitted for job ${jobId}`);

    res.json({
      message: "Job accepted",
      job: {
        _id: job._id,
        title: job.title,
        status: job.status,
        assignedWorkerId: job.assignedWorkerId,
        pricing: job.pricing,
        paymentStatus: job.paymentStatus,
      }
    });
  } catch (err) {
    console.error("❌ Accept job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /my-worker - Get current user's worker
WorkerRouter.get("/my-worker", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });

    if (!worker) {
      return res.status(404).json({ message: "No worker found for this user" });
    }

    res.status(200).json({ message: "Worker found", worker });
  } catch (err) {
    console.error("Error fetching user's worker:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /job/:jobId/details
WorkerRouter.get("/job/:jobId/details", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (deviceId) {
      if ((job.status === 'assigned' || job.status === 'completed') &&
        job.assignedWorkerId !== deviceId) {
        return res.status(403).json({
          message: "Unauthorized - job not assigned to this worker"
        });
      }
    }

    let zipMetadata = null;
    let zipFilesList = [];
    let filesExtractedFromZip = false;

    if (job.zipFileUrl) {
      try {
        const urlParts = job.zipFileUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `jobs/${fileName}`;

        console.log("Fetching metadata for:", filePath);

        const { data: fileData, error: fileError } = await supabase.storage
          .from("jobs")
          .list("jobs", { limit: 100, offset: 0 });

        if (!fileError && fileData) {
          const fileInfo = fileData.find((f) => f.name === fileName);
          if (fileInfo) {
            zipMetadata = {
              name: fileInfo.name,
              size: fileInfo.metadata?.size || 0,
              createdAt: fileInfo.created_at,
              lastModified: fileInfo.updated_at,
            };
          }
        }

        try {
          const { data: zipData, error: downloadError } = await supabase.storage
            .from("jobs")
            .download(filePath);

          if (!downloadError && zipData) {
            const arrayBuffer = await zipData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();

            zipFilesList = entries
              .filter((entry) => !entry.isDirectory)
              .map((entry) => {
                const fileName = entry.entryName;
                let fileType = "File";
                let required = false;

                if (fileName === "requirements.txt") {
                  fileType = "Dependencies";
                  required = true;
                } else if (fileName === job.config.entryFile) {
                  fileType = "Entry Point";
                  required = true;
                } else if (fileName.endsWith(".py")) {
                  fileType = "Python Script";
                } else if (fileName.includes("dataset") || fileName.includes("data")) {
                  fileType = "Training Data";
                } else if (fileName.endsWith(".txt")) {
                  fileType = "Text File";
                } else if (fileName.endsWith(".json")) {
                  fileType = "Configuration";
                } else if (fileName.endsWith(".csv")) {
                  fileType = "Dataset";
                }

                return {
                  name: fileName,
                  type: fileType,
                  required,
                  size: entry.header.size,
                };
              });

            filesExtractedFromZip = true;
            console.log(`Successfully extracted ${zipFilesList.length} files from ZIP`);
          }
        } catch (zipError) {
          console.error("Failed to extract ZIP contents:", zipError);
          zipFilesList = [
            { name: "requirements.txt", type: "Dependencies", required: true },
            { name: job.config.entryFile || "main.py", type: "Entry Point", required: true },
          ];
        }
      } catch (supabaseErr) {
        console.error("Supabase metadata fetch error:", supabaseErr);
        zipFilesList = [
          { name: "requirements.txt", type: "Dependencies", required: true },
          { name: job.config.entryFile || "main.py", type: "Entry Point", required: true },
        ];
      }
    }

    res.status(200).json({
      message: "Job details fetched successfully",
      job: {
        _id: job._id,
        userId: job.userId,
        title: job.title,
        description: job.description,
        status: job.status,
        zipFileUrl: job.zipFileUrl,
        config: job.config,
        assignedWorkerId: job.assignedWorkerId,
        logs: job.logs,
        modelUrl: job.modelUrl,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      zipMetadata,
      zipFilesList,
      filesExtractedFromZip,
    });
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ PUT /pricing - Worker updates their pricing
WorkerRouter.put("/pricing", authMiddleware, async (req, res) => {
  try {
    const { hourlyRate, minimumCharge } = req.body;

    if (hourlyRate !== undefined && (hourlyRate < 0 || hourlyRate > 1000)) {
      return res.status(400).json({ message: "Invalid hourly rate (must be between 0 and 1000)" });
    }

    if (minimumCharge !== undefined && (minimumCharge < 0 || minimumCharge > 100)) {
      return res.status(400).json({ message: "Invalid minimum charge (must be between 0 and 100)" });
    }

    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found. Please register first." });
    }

    if (hourlyRate !== undefined) worker.pricing.hourlyRate = hourlyRate;
    if (minimumCharge !== undefined) worker.pricing.minimumCharge = minimumCharge;

    await worker.save();

    res.json({ message: "Pricing updated successfully", pricing: worker.pricing });
  } catch (err) {
    console.error("Update pricing error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /pricing - Get worker's current pricing
WorkerRouter.get("/pricing", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    res.json({
      pricing: worker.pricing,
      totalEarnings: worker.totalEarnings,
      pendingEarnings: worker.pendingEarnings,
    });
  } catch (err) {
    console.error("Get pricing error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /earnings - Get worker's earnings summary
WorkerRouter.get("/earnings", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const completedJobs = await Job.find({
      assignedWorkerId: worker.deviceId,
      status: "completed",
    }).select("title pricing createdAt");

    const inProgressJobs = await Job.find({
      assignedWorkerId: worker.deviceId,
      status: { $in: ["assigned", "processing"] },
    }).select("title pricing createdAt");

    res.json({
      totalEarnings: worker.totalEarnings,
      pendingEarnings: worker.pendingEarnings,
      walletBalance: worker.walletBalance,
      totalJobsCompleted: worker.totalJobsCompleted,
      pricing: worker.pricing,
      completedJobs: completedJobs.map(job => ({
        id: job._id,
        title: job.title,
        earnings: job.pricing?.actualCost || 0,
        completedAt: job.createdAt,
      })),
      inProgressJobs: inProgressJobs.map(job => ({
        id: job._id,
        title: job.title,
        estimatedEarnings: job.pricing?.estimatedCost || 0,
        startedAt: job.createdAt,
      })),
    });
  } catch (err) {
    console.error("Get earnings error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ GET /wallet - Get worker's wallet balance and transactions
WorkerRouter.get("/wallet", authMiddleware, async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.userId });
    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const Transaction = (await import("../schemas/TransactionSchema.js")).default;
    const transactions = await Transaction.find({ workerId: worker._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("jobId", "title");

    res.json({
      walletBalance: worker.walletBalance,
      totalEarnings: worker.totalEarnings,
      pendingEarnings: worker.pendingEarnings,
      transactions: transactions.map(tx => ({
        id: tx._id,
        type: tx.type,
        amount: tx.amount,
        status: tx.status,
        description: tx.description,
        jobTitle: tx.jobId?.title || "N/A",
        createdAt: tx.createdAt,
      })),
    });
  } catch (err) {
    console.error("Get wallet error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default WorkerRouter;