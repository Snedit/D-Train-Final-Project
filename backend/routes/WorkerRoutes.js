import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";

const WorkerRouter = Router();

/**
 * POST /register
 * Worker installs the desktop app → registers this machine as a worker node
 */
WorkerRouter.get('/', async (req, res)=>{
  try {
    const workers = await Worker.find();
    return res.status(200).json({message: "workers available", workers});
  } catch (error) {
    console.log(error);
    return res.status(500).json({message: "error fetching workers"});
    
  }
})

WorkerRouter.post("/register", async (req, res) => {
  try {
    const { deviceId, os, cpu, ram, gpu } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId required" });

    const worker = await Worker.findOneAndUpdate(
      { deviceId },
      {
        deviceId,
        os,
        cpu,
        ram,
        gpu,
        status: "online",
      },
      { upsert: true, new: true }
    );

    res.json({ message: "Worker registered", worker });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


WorkerRouter.post("/push-log", async (req, res) => {
  try {
    const { jobId, deviceId, line } = req.body;

    if (!jobId || !deviceId || !line)
      return res.status(400).json({ message: "jobId, deviceId and line required" });

    // Save log in DB
    await Job.findByIdAndUpdate(jobId, {
      $push: { logs: { ts: Date.now(), message: line } }
    });

    // Emit to socket clients
    req.app.get("io").to(`job_${jobId}`).emit("job_log", {
      job_id: jobId,
      line,
    });

    res.json({ message: "Log streamed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


WorkerRouter.post("/heartbeat", async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) return res.status(400).json({ message: "deviceId missing" });

    await Worker.findOneAndUpdate(
      { deviceId },
      { lastHeartbeat: Date.now(), status: "online" }
    );

    res.json({ message: "Heartbeat received" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /accept-job
 * Worker accepts a pending job offered via Redis
 */
WorkerRouter.post("/accept-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.status !== "pending")
      return res.status(400).json({ message: "Job already taken" });

    job.status = "assigned";
    job.assignedWorkerId = deviceId;
    await job.save();

    res.json({ message: "Job accepted", job });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /metrics
 * Worker reports CPU/GPU/RAM usage during training
 */
WorkerRouter.post("/metrics", async (req, res) => {
  try {
    const { jobId, deviceId, cpu, ram, gpu, durationMs } = req.body;

    await Billing.create({
      userId: null, // will link automatically after job completion
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

/**
 * POST /complete
 * Worker uploads final model URL + logs
 */
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

export default WorkerRouter;
