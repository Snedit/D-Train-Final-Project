import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Worker from "../schemas/WorkerSchema.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";
import { supabase } from "../utils/supabaseClient.js";
import AdmZip from "adm-zip";

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
      worker,
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
      return res.status(400).json({
        message: "jobId, deviceId and line required",
      });
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

// GET /job/:jobId/details - Get detailed job information including ZIP metadata
WorkerRouter.get("/job/:jobId/details", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Fetch job from database
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Extract file path from the zipFileUrl
    let zipMetadata = null;
    let zipFilesList = [];
    let filesExtractedFromZip = false;

    if (job.zipFileUrl) {
      try {
        // Extract the file path from the public URL
        const urlParts = job.zipFileUrl.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `jobs/${fileName}`;

        console.log("Fetching metadata for:", filePath);

        // Get file metadata from Supabase
        const { data: fileData, error: fileError } = await supabase.storage
          .from("jobs")
          .list("jobs", {
            limit: 100,
            offset: 0,
          });

        if (!fileError && fileData) {
          // Find the specific file
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

        // Download and extract actual ZIP contents from Supabase
        try {
          const { data: zipData, error: downloadError } = await supabase.storage
            .from("jobs")
            .download(filePath);

          if (!downloadError && zipData) {
            // Convert blob to buffer
            const arrayBuffer = await zipData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Extract ZIP contents using adm-zip
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();

            // Map actual files from ZIP
            zipFilesList = entries
              .filter((entry) => !entry.isDirectory) // Exclude directories
              .map((entry) => {
                const fileName = entry.entryName;
                let fileType = "File";
                let required = false;

                // Determine file type and if it's required
                if (fileName === "requirements.txt") {
                  fileType = "Dependencies";
                  required = true;
                } else if (fileName === job.config.entryFile) {
                  fileType = "Entry Point";
                  required = true;
                } else if (fileName.endsWith(".py")) {
                  fileType = "Python Script";
                } else if (
                  fileName.includes("dataset") ||
                  fileName.includes("data")
                ) {
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
            console.log(
              `Successfully extracted ${zipFilesList.length} files from ZIP`
            );
          }
        } catch (zipError) {
          console.error("Failed to extract ZIP contents:", zipError);
          // Fallback to expected files if ZIP extraction fails
          zipFilesList = [
            {
              name: "requirements.txt",
              type: "Dependencies",
              required: true,
            },
            {
              name: job.config.entryFile || "main.py",
              type: "Entry Point",
              required: true,
            },
          ];
        }
      } catch (supabaseErr) {
        console.error("Supabase metadata fetch error:", supabaseErr);
        // Fallback to basic expected files
        zipFilesList = [
          {
            name: "requirements.txt",
            type: "Dependencies",
            required: true,
          },
          {
            name: job.config.entryFile || "main.py",
            type: "Entry Point",
            required: true,
          },
        ];
      }
    }

    // Return complete job details
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
      filesExtractedFromZip, // Indicates if actual ZIP was read
    });
  } catch (err) {
    console.error("Error fetching job details:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default WorkerRouter;
