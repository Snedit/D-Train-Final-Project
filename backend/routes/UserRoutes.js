import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {signPayload} from '../utils/jwt.js'
import User from "../schemas/UserSchema.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import Job from "../schemas/JobSchema.js"
import Billing from "../schemas/BillingSchema.js" 

const UserRouter = Router();

/**
 * POST /login
 * Logs the user in and returns JWT
 */
UserRouter.get('/', (req, res)=>{
  res.json({"message" : "this api is running"})
});
UserRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials." });

    const token = signPayload({ userId: user._id, role: user.role });

    res.json({ message: "Login successful.", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * POST /register
 * Creates a new user
 */
UserRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Missing fields." });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already used." });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash: hash,
    });

    res.status(201).json({
      message: "Registration successful.",
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * GET /profile
 * Get logged-in user's profile
 */
UserRouter.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user)
      return res.status(404).json({ message: "User not found." });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * GET /usage
 * Fetch usage stats: jobs, cost, metrics, etc.
 */
UserRouter.get("/usage", authMiddleware, async (req, res) => {
  try {
    // Example implementation — you will adjust once Job + Billing exist.
    const jobs = await Job.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    const bills = await Billing.find({ userId: req.user.userId });

    res.json({
      totalJobs: jobs.length,
      totalSpent: bills.reduce((acc, b) => acc + b.amount, 0),
      jobs,
      bills,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error." });
  }
});

export default UserRouter;
