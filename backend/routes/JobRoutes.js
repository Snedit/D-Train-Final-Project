import { Router } from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";

const JobRouter = Router();


JobRouter.post("/create", authMiddleware, async (req, res) => {
  try {
    const { zipUrl, requirements, metadata } = req.body;

    if (!zipUrl) return res.status(400).json({ message: "zipUrl required" });

    const job = await Job.create({
      userId: req.user.userId,
      zipUrl,
      requirements,
      metadata,
      status: "pending",
    });

    // You will also publish to Redis here: "new_job" → job._id

    res.status(201).json({ message: "Job created", job });
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
