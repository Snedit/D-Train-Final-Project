import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import UserRouter from "./routes/UserRoutes.js";
import WorkerRouter from "./routes/WorkerRoutes.js";
import JobRouter from "./routes/JobRoutes.js";

dotenv.config(); // load .env

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Routers
app.use("/api/user", UserRouter);
app.use("/api/worker", WorkerRouter);
app.use("/api/jobs", JobRouter);

// DB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("Mongo connection error:", err));

// Default root route
app.get("/", (req, res) => {
  res.send("ML Distributed Compute Backend Running");
});

// Error handling middleware (optional but recommended)
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ message: "Internal server error." });
});

app.listen(port, () => {
  console.log(`Backend started at port ${port}`);
});
