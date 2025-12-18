import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";

const WorkerRouter = Router();

// GET / - Fetch all workers
WorkerRouter.get("/", async (req, res) => {
  try {
    const workers = await Worker.find();
    return res.status(200).json({ message: "workers available", workers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "error fetching workers" });
  }
});

// POST /register - Worker registration with authentication
WorkerRouter.post("/register", authMiddleware, async (req, res) => {
  try {
    const { deviceId, os, cpu, ram, gpu } = req.body;

    console.log("Registration request:", { deviceId, os, cpu, ram, gpu });
    console.log("Authenticated user:", req.user.userId);

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

    // Create/update worker with userId link
    const worker = await Worker.findOneAndUpdate(
      { deviceId },
      {
        userId: req.user.userId, // Link to authenticated user
        deviceId,
        systemInfo: {
          cpu: cpu || "Unknown",
          gpu: gpu || "N/A",
          ram: ram || "Unknown",
        },
        currentStatus: "online",
        lastHeartbeatAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    console.log("Worker created/updated:", worker);

    res.status(201).json({ 
      message: "Worker registered successfully", 
      worker 
    });
  } catch (err) {
    console.error("Worker registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /metrics - Worker reports CPU/GPU/RAM usage during training
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

// POST /complete - Worker uploads final model URL & logs
WorkerRouter.post("/complete", async (req, res) => {
  try {
    const { jobId, modelUrl, logsUrl } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    job.status = "completed";
    job.modelUrl = modelUrl;
    job.logsUrl = logsUrl;
    job.completedAt = Date.now();
    await job.save();

    res.json({ message: "Job marked completed", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /push-log - Stream logs to frontend
WorkerRouter.post("/push-log", async (req, res) => {
  try {
    const { jobId, deviceId, line } = req.body;

    if (!jobId || !deviceId || !line) {
      return res.status(400).json({ message: "jobId, deviceId and line required" });
    }

    await Job.findByIdAndUpdate(jobId, {
      $push: { logs: { ts: Date.now(), message: line } },
    });

    req.app.get("io").to(`job:${jobId}`).emit("job:log", { jobId, line });

    res.json({ message: "Log streamed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /heartbeat - Worker sends heartbeat
WorkerRouter.post("/heartbeat", async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId missing" });
    }

    await Worker.findOneAndUpdate(
      { deviceId },
      { lastHeartbeatAt: Date.now(), currentStatus: "online" }
    );

    res.json({ message: "Heartbeat received" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /accept-job - Worker accepts a pending job
WorkerRouter.post("/accept-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });

    if (job.status !== "pending") {
      return res.status(400).json({ message: "Job already taken" });
    }

    job.status = "assigned";
    job.assignedWorkerId = deviceId;
    await job.save();

    res.json({ message: "Job accepted", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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

export default WorkerRouter;
