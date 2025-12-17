import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { signPayload } from "../utils/jwt.js";
import User from "../schemas/UserSchema.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import Job from "../schemas/JobSchema.js";
import Billing from "../schemas/BillingSchema.js";

const UserRouter = Router();

/**
 * GET /
 * Health check
 */
UserRouter.get("/", (req, res) => {
  res.json({ message: "User API is running" });
});

/**
 * POST /login
 * Logs the user in and returns JWT
 */
UserRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found." });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials." });

    const token = signPayload({ userId: user._id, role: user.role });

    res.json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * POST /register
 * Creates a new user and returns JWT token
 */
UserRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });

    // Check if email already exists
    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already registered." });

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      role: "client", // Default role
    });

    // Generate JWT token immediately
    const token = signPayload({ userId: user._id, role: user.role });

    res.status(201).json({
      message: "Registration successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

/**
 * GET /profile
 * Get logged-in user's profile
 */
UserRouter.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found." });

    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

/**
 * GET /usage
 * Fetch usage stats: jobs, cost, metrics, etc.
 */
UserRouter.get("/usage", authMiddleware, async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    const bills = await Billing.find({ userId: req.user.userId });

    res.json({
      totalJobs: jobs.length,
      totalSpent: bills.reduce((acc, b) => acc + b.amount, 0),
      jobs,
      bills,
    });
  } catch (err) {
    console.error("Usage fetch error:", err);
    res.status(500).json({ message: "Server error." });
  }
});

export default UserRouter;
