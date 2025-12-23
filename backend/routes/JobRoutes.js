import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";

import multer from "multer";
import AdmZip from "adm-zip";
import { supabase } from "../utils/supabaseClient.js";
import redisPublisher from "../utils/redis.js";

const JobRouter = Router();
const upload = multer({ storage: multer.memoryStorage() }); // handle zip upload

JobRouter.get('/', authMiddleware, async (req, res)=>{

  try{

    const jobs  = await Job.find({
    userId : req.user.userId
  });
  return res.status(200).json({message: "jobs fetched", jobs})
}
catch (err)
{
  console.log(err);
  return res.status(500).json({messae: " error fetching the jobs"})
}

});


JobRouter.post("/create", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      const { mainFileName, title, description } = req.body;
      console.table(req.body);
      console.log(  req. user);
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
        config: {entryFile: mainFileName},
        zipFileUrl: publicUrl,
        status: "pending",
        title: title,
        description: description,
        logs: [],
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
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

JobRouter.get("/:jobId/status", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) return res.status(404).json({ message: "Job not found" });
    if (job.userId.toString() !== req.user.userId)
      return res.status(403).json({ message: "Unauthorized" });

    res.json(job);
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

    // Update job
    job.status = "completed";
    job.modelUrl = publicUrl; // Store ZIP URL
    job.logs = parsedLogs; // Store logs array
    job.completedAt = new Date();
    await job.save();

    console.log(`✅ Job ${jobId} marked as completed`);

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

    // Update job
    job.status = "failed";
    job.errorMessage = errorMessage || "Job failed without error message";
    job.logs = parsedLogs;
    job.completedAt = new Date();
    await job.save();

    console.log(`❌ Job ${jobId} marked as failed: ${errorMessage}`);

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
