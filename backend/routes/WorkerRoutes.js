import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";
import { supabase } from "../utils/supabaseClient.js";
import AdmZip from "adm-zip";

const WorkerRouter = Router();

// ✅ HELPER: Optional authentication middleware
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    return authMiddleware(req, res, next);
  }
  
  req.user = null;
  next();
};

// GET / - Fetch all workers (admin endpoint - keep auth)
WorkerRouter.get("/", authMiddleware, async (req, res) => {
  try {
    const workers = await Worker.find();
    return res.status(200).json({ message: "workers available", workers });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "error fetching workers" });
  }
});

// ✅ GET /available-jobs - Remove authMiddleware for workers
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
      
      worker.lastHeartbeatAt = Date.now();
      worker.currentStatus = "online";
      await worker.save();
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

// POST /register - Worker registration with authentication
WorkerRouter.post("/register", authMiddleware, async (req, res) => {
  try {
    const { deviceId, os, cpu, ram, gpu } = req.body;

    console.log("Registration request:", { deviceId, os, cpu, ram, gpu });
    console.log("Authenticated user:", req.user.userId);

    if (!deviceId) {
      return res.status(400).json({ message: "deviceId required" });
    }

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

// POST /push-log - Stream logs
WorkerRouter.post("/push-log", async (req, res) => {
  try {
    const { jobId, deviceId, line } = req.body;

    if (!jobId || !deviceId || !line) {
      return res.status(400).json({
        message: "jobId, deviceId and line required",
      });
    }

    await Job.findByIdAndUpdate(jobId, {
      $push: { logs: { ts: Date.now(), message: line } },
    });

    // ✅ FIXED: Use consistent socket room naming
    req.app.get("io").to(`job:${jobId}`).emit("job:log", { jobId, line });

    res.json({ message: "Log streamed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /heartbeat - Worker heartbeat
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

// ✅ FIXED: POST /accept-job with Socket.io broadcast
WorkerRouter.post("/accept-job", async (req, res) => {
  try {
    const { jobId, deviceId } = req.body;

    console.log(`📥 Worker ${deviceId} attempting to accept job ${jobId}`);

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Check if job is still available
    if (job.status !== "pending" && job.status !== "queued") {
      console.log(`❌ Job ${jobId} already taken. Status: ${job.status}`);
      return res.status(400).json({ 
        message: "Job already taken",
        currentStatus: job.status 
      });
    }

    // Update job status
    job.status = "assigned";
    job.assignedWorkerId = deviceId;
    await job.save();

    console.log(`✅ Job ${jobId} assigned to worker ${deviceId}`);

    // ✅ EMIT SOCKET EVENT to notify frontend
    const io = req.app.get("io");
    
    // Emit to all connected clients
    io.emit("job_status_changed", {
      jobId: job._id,
      status: "assigned",
      assignedWorkerId: deviceId,
      timestamp: new Date().toISOString()
    });

    // Also emit to specific job room (if frontend joins rooms)
    io.to(`job:${jobId}`).emit("job_accepted", {
      jobId: job._id,
      workerId: deviceId,
      status: "assigned"
    });

    console.log(`📡 Socket events emitted for job ${jobId}`);

    res.json({ 
      message: "Job accepted", 
      job: {
        _id: job._id,
        title: job.title,
        status: job.status,
        assignedWorkerId: job.assignedWorkerId
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

// ✅ GET /job/:jobId/details - Complete updated route
WorkerRouter.get("/job/:jobId/details", async (req, res) => {
  try {
    const { jobId } = req.params;
    const { deviceId } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Allow PENDING/QUEUED jobs (anyone can view to accept) 
    // OR ASSIGNED/COMPLETED to this specific worker
    if (deviceId) {
      if ((job.status === 'assigned' || job.status === 'completed') && 
          job.assignedWorkerId !== deviceId) {
        return res.status(403).json({ 
          message: "Unauthorized - job not assigned to this worker" 
        });
      }
    }

    // Extract file path from the zipFileUrl
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
          .list("jobs", {
            limit: 100,
            offset: 0,
          });

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
                  required: required,
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

export default WorkerRouter;