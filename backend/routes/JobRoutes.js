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

JobRouter.post("/create", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      const { mainFileName } = req.body;
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
        mainFile: mainFileName,
        zipFileUrl: publicUrl,
        status: "pending",
        logs: [],
        createdAt: new Date(),
      });

      // -----------------------------
      // 4. Publish Redis Event
      // -----------------------------
      await redisPublisher.publish(
        "new_job",
        JSON.stringify({ jobId: job._id, zipUrl: publicUrl, mainFileName })
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

export default JobRouter;
