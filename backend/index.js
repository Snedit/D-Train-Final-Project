import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

import UserRouter from "./routes/UserRoutes.js";
import WorkerRouter from "./routes/WorkerRoutes.js";
import JobRouter from "./routes/JobRoutes.js";
import PaymentRouter from "./routes/PaymentRoutes.js";
import Job from "./schemas/JobSchema.js";
import Worker from "./schemas/WorkerSchema.js";
import { getElapsedSeconds } from "./utils/paymentHelpers.js";
import morgan from "morgan";

dotenv.config();

const app  = express();
const port = process.env.PORT || 5000;

/* ---------- middleware ---------- */
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("dev"));

/* ---------- http server ---------- */
const server = http.createServer(app);

/* ---------- socket.io ---------- */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout:  60000,
  pingInterval: 25000
});

/* 🔑 Make io available in routes */
app.set("io", io);

/* ---------- socket events ---------- */
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // ✅ Worker identifies itself so we can track socket → worker mapping
  socket.on("register_worker", ({ deviceId }) => {
    if (!deviceId) return;
    socket.deviceId = deviceId;
    socket.join(`worker:${deviceId}`);
    console.log(`✅ Worker ${deviceId} registered with socket ${socket.id}`);
  });

  socket.on("join_job", ({ job_id, jobId }) => {
    const id = job_id || jobId;
    socket.join(`job:${id}`);
    socket.join(`job_${id}`);
    console.log(`✅ Socket ${socket.id} joined job:${id}`);
  });

  socket.on("leave_job", ({ job_id, jobId }) => {
    const id = job_id || jobId;
    socket.leave(`job:${id}`);
    socket.leave(`job_${id}`);
    console.log(`👋 Socket ${socket.id} left job:${id}`);
  });

  // ✅ Mark worker offline IMMEDIATELY on disconnect
  socket.on("disconnect", async (reason) => {
    console.log("🔴 Socket disconnected:", socket.id, "Reason:", reason);

    if (socket.deviceId) {
      const deviceId = socket.deviceId;
      try {
        const worker = await Worker.findOne({ deviceId });
        if (!worker) return;
        if (!["online", "idle", "busy"].includes(worker.currentStatus)) return;

        worker.currentStatus = "offline";
        await worker.save();
        console.log(`📴 Worker ${deviceId} marked offline instantly on disconnect`);

        io.emit("worker_status_changed", {
          workerId:  worker._id,
          deviceId:  worker.deviceId,
          status:    "offline",
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error("❌ Error handling worker disconnect:", err.message);
      }
    }
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// ✅ Global socket event emitter helper
export const emitJobUpdate = (io, jobId, eventType, data) => {
  console.log(`📡 Emitting ${eventType} for job ${jobId}`);
  io.to(`job:${jobId}`).emit(eventType, data);
  io.emit(eventType, data);
};

app.set("emitJobUpdate", emitJobUpdate);

/* ---------- db ---------- */
mongoose
  .connect(`${process.env.MONGO_URI}/dtrain`)
  .then(() => {
    console.log("✅ MongoDB connected");
    startTimeTracking(io);   // ← replaces startCostTracking
    startHeartbeatChecker(io);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ---------- routes ---------- */
app.use("/api/user",    UserRouter);
app.use("/api/worker",  WorkerRouter);
app.use("/api/jobs",    JobRouter);
app.use("/api/payment", PaymentRouter);

// Alias so App.tsx fetchWalletBalance (GET /api/user/wallet) resolves correctly
app.use("/api/user", PaymentRouter);

/* ---------- health check ---------- */
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "ML Distributed Compute Backend",
    socketConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

/* ---------- 404 handler ---------- */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found", path: req.path });
});

/* ---------- error handler ---------- */
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

/* ---------- Real-time Time Tracking ---------- */
// Replaces the old cost tracking interval.
// Emits elapsed seconds only — pricing is a fixed tier fee, no per-second calc.
const startTimeTracking = (io) => {
  console.log("⏱️  Starting real-time time tracking...");

  setInterval(async () => {
    try {
      const activeJobs = await Job.find({
        status: { $in: ["assigned", "processing"] },
        "pricing.startTime": { $exists: true }
      });

      activeJobs.forEach((job) => {
        if (!job.pricing.startTime) return;

        io.to(`job:${job._id}`).emit("job:time_update", {
          jobId:          job._id,
          elapsedSeconds: getElapsedSeconds(job.pricing.startTime),
          tierPrice:      job.pricing?.tierPrice,
          timestamp:      new Date().toISOString()
        });
      });
    } catch (err) {
      console.error("❌ Time tracking error:", err.message);
    }
  }, 1000);
};

/* ---------- Heartbeat Timeout Checker ---------- */
// Fallback safety net for hard crashes / network drops without a clean TCP close.
const HEARTBEAT_TIMEOUT_MS = 60 * 1000;

const startHeartbeatChecker = (io) => {
  console.log("💓 Starting heartbeat timeout checker...");

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);

      const staleWorkers = await Worker.find({
        currentStatus:   { $in: ["online", "idle", "busy"] },
        lastHeartbeatAt: { $lt: cutoff }
      });

      if (staleWorkers.length === 0) return;

      console.log(`⚠️  Marking ${staleWorkers.length} stale worker(s) as offline`);

      for (const worker of staleWorkers) {
        worker.currentStatus = "offline";
        await worker.save();
        console.log(`📴 Worker ${worker.deviceId} marked offline by heartbeat checker`);

        io.emit("worker_status_changed", {
          workerId:  worker._id,
          deviceId:  worker.deviceId,
          status:    "offline",
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("❌ Heartbeat checker error:", err.message);
    }
  }, 30 * 1000);
};

/* ---------- start ---------- */
server.listen(port, () => {
  console.log(`🚀 Backend + Socket.IO running on port ${port}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(`🌐 CORS enabled for all origins`);
});

/* ---------- graceful shutdown ---------- */
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("✅ Server and MongoDB closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log("✅ Server and MongoDB closed");
      process.exit(0);
    });
  });
});