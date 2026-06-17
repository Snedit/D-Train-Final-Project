import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { io, Socket } from "socket.io-client";
import HeroSection from "./components/HeroSection";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import WorkerRegistration from "./components/WorkerRegistration";
import WorkerDashboard from "./components/WorkerDashboard";
import RunningJobs from "./components/RunningJobs";
import JobDetail from "./components/JobDetail";
import Documentation from "./components/Documentation";
import type { Worker as WorkerType, Job } from "./types";
import { API_BASE } from "./config";
import DockerGate from "./components/DockerGate";

const TOKEN_KEY = "dtrain_worker_token";
const WORKER_KEY = "dtrain_worker";

function App() {
  const [currentView, setCurrentView] = useState<
    | "dockerCheck"
    | "hero"
    | "signin"
    | "signup"
    | "workerRegister"
    | "dashboard"
    | "runningJob"
    | "jobDetail"
    | "documentation"
  >("dockerCheck");

  const [worker, setWorker] = useState<WorkerType | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // ✅ Initialize Socket.io connection
  useEffect(() => {
    console.log("🔌 Initializing Worker Socket.IO connection...");

    const newSocket = io(API_BASE || undefined, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    newSocket.on("connect", () => {
      console.log("✅ Worker Socket connected:", newSocket.id);

      // ✅ On every (re)connect: register the worker socket with the server
      // AND immediately send a heartbeat so server marks us online right away
      const savedWorker = localStorage.getItem(WORKER_KEY);
      if (savedWorker) {
        try {
          const w: WorkerType = JSON.parse(savedWorker);
          if (w?.deviceId) {
            // Tell server which worker owns this socket
            newSocket.emit("register_worker", { deviceId: w.deviceId });
            console.log("📋 Registered worker socket on connect:", w.deviceId);

            // Immediately send a heartbeat so server flips status to online instantly
            fetch(`${API_BASE}/api/worker/heartbeat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceId: w.deviceId }),
            }).catch((err) =>
              console.error("❌ Reconnect heartbeat failed:", err),
            );
          }
        } catch {
          // ignore JSON parse errors from corrupted storage
        }
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("⚠️ Worker Socket disconnected:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Worker Socket connection error:", error);
    });

    newSocket.on("job_status_changed", (data) => {
      console.log("📡 Worker received job status change:", data);

      // ─── Auto-redirect: job was re-queued while worker was on the detail page ───
      // The idle-timeout checker emits { status: "pending", reason: "worker_idle_timeout" }
      // If this worker is currently viewing that exact job, send them back to dashboard.
      if (data.reason === "worker_idle_timeout" && data.status === "pending") {
        setCurrentJobId((prevJobId) => {
          if (prevJobId && prevJobId === data.jobId?.toString()) {
            console.log(
              "⏱️ Job re-queued by idle timeout — redirecting to dashboard",
            );
            alert(
              "⏱️ This job was re-queued because it was idle too long. You can accept it again from the dashboard.",
            );
            setCurrentView("dashboard");
            return null;
          }
          return prevJobId;
        });
      }
    });

    newSocket.on("job_accepted", (data) => {
      console.log("📡 Worker received job accepted:", data);
      window.dispatchEvent(new CustomEvent("job_accepted", { detail: data }));
    });

    // ✅ Server marks this worker offline — update local state immediately
    newSocket.on("worker_status_changed", (data) => {
      console.log("📡 Worker status changed:", data);
      setWorker((prev) => {
        if (!prev) return prev;
        if (prev._id === data.workerId || prev.deviceId === data.deviceId) {
          console.log(`📴 This worker marked ${data.status} by server`);
          return { ...prev, currentStatus: data.status, status: data.status };
        }
        return prev;
      });
    });

    setSocket(newSocket);

    return () => {
      console.log("🧹 Cleaning up Worker Socket.IO connection");
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("job_status_changed");
      newSocket.off("job_accepted");
      newSocket.off("worker_status_changed");
      newSocket.close();
    };
  }, []);

  // ✅ Re-register socket with server whenever worker state changes
  // (covers the case where worker logs in after the socket was already open)
  useEffect(() => {
    if (socket && worker?.deviceId && socket.connected) {
      socket.emit("register_worker", { deviceId: worker.deviceId });
      console.log(
        "📋 Re-registered worker socket after worker state update:",
        worker.deviceId,
      );
    }
  }, [worker?.deviceId, socket]);

  // ✅ Periodic heartbeat — keeps worker marked online every 25s.
  // Server marks offline after 60s without a heartbeat, so 25s is a safe interval.
  // Also fires immediately on mount so status is correct right away.
  useEffect(() => {
    if (!worker?.deviceId) return;

    console.log("💓 Starting heartbeat for worker:", worker.deviceId);

    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/api/worker/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: worker.deviceId }),
        });
        console.log("💓 Heartbeat sent for:", worker.deviceId);
      } catch (err) {
        console.error("❌ Heartbeat failed:", err);
      }
    };

    // Fire immediately so status is online the moment the worker mounts
    sendHeartbeat();

    const heartbeatInterval = setInterval(sendHeartbeat, 25000);

    return () => {
      console.log("🛑 Stopping heartbeat for worker:", worker.deviceId);
      clearInterval(heartbeatInterval);
    };
  }, [worker?.deviceId]);

  // ✅ Check if user is already logged in on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedWorker = localStorage.getItem(WORKER_KEY);

    if (savedToken && savedWorker) {
      try {
        const parsedWorker: WorkerType = JSON.parse(savedWorker);
        setIsAuthenticated(true);
        setWorker(parsedWorker);
      } catch {
        // corrupted storage — clear and start fresh
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(WORKER_KEY);
        localStorage.removeItem("dtrain_worker_user");
      }
    }
  }, []);

  const checkExistingWorker = async (
    token: string,
  ): Promise<WorkerType | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/worker/my-worker`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.worker) {
          const workerObj: WorkerType = {
            _id: data.worker._id,
            deviceId: data.worker.deviceId,
            currentStatus: data.worker.currentStatus || "online",
            status: data.worker.currentStatus || "online",
            os: data.worker.systemInfo?.os || "Unknown",
            cpu: data.worker.systemInfo?.cpu || "Unknown",
            ram: data.worker.systemInfo?.ram || "Unknown",
            gpu: data.worker.systemInfo?.gpu || "N/A",
            lastHeartbeatAt: data.worker.lastHeartbeatAt
              ? new Date(data.worker.lastHeartbeatAt).getTime()
              : undefined,
            createdAt: data.worker.createdAt,
          };
          return workerObj;
        }
      }
      return null;
    } catch (err) {
      console.error("Error checking existing worker:", err);
      return null;
    }
  };

  const handleGetStarted = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView(isAuthenticated ? "dashboard" : "signin");
      setIsLoading(false);
    }, 800);
  };

  const handleDocumentation = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("documentation");
      setIsLoading(false);
    }, 800);
  };

  const handleBackToHero = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("hero");
      setIsLoading(false);
    }, 800);
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      const loginRes = await fetch(`${API_BASE}/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.message || "Login failed");

      localStorage.setItem(TOKEN_KEY, loginData.token);
      localStorage.setItem(
        "dtrain_worker_user",
        JSON.stringify(loginData.user),
      );
      setIsAuthenticated(true);
      setIsLoading(true);

      const existingWorker = await checkExistingWorker(loginData.token);

      setTimeout(() => {
        if (existingWorker) {
          setWorker(existingWorker);
          localStorage.setItem(WORKER_KEY, JSON.stringify(existingWorker));
          setCurrentView("dashboard");
        } else {
          setCurrentView("workerRegister");
        }
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      throw new Error(err.message || "Something went wrong");
    }
  };

  const handleSignUp = async (
    name: string,
    email: string,
    password: string,
  ) => {
    try {
      setIsLoading(true);

      const registerRes = await fetch(`${API_BASE}/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const registerData = await registerRes.json();
      if (!registerRes.ok)
        throw new Error(registerData.message || "Registration failed");

      if (registerData.token) {
        localStorage.setItem(TOKEN_KEY, registerData.token);
        localStorage.setItem(
          "dtrain_worker_user",
          JSON.stringify(registerData.user),
        );
        setIsAuthenticated(true);

        const existingWorker = await checkExistingWorker(registerData.token);

        setTimeout(() => {
          if (existingWorker) {
            setWorker(existingWorker);
            localStorage.setItem(WORKER_KEY, JSON.stringify(existingWorker));
            setCurrentView("dashboard");
          } else {
            setCurrentView("workerRegister");
          }
          setIsLoading(false);
        }, 500);
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    }
  };

  const handleWorkerRegister = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) throw new Error("Please sign in first");

      let deviceInfo: { os: string; cpu: string; ram: string; gpu: string };

      const isElectron =
        (window as any).worker &&
        typeof (window as any).worker.getDeviceInfo === "function";

      console.log("🔍 Environment check:", {
        hasWorkerAPI: !!(window as any).worker,
        hasGetDeviceInfo: isElectron,
        userAgent: navigator.userAgent.includes("Electron")
          ? "Electron"
          : "Browser",
      });

      if (isElectron) {
        console.log("⚡ Using Electron device info...");
        const electronInfo = await (window as any).worker.getDeviceInfo();
        deviceInfo = {
          os: electronInfo.os || "Unknown OS",
          cpu:
            electronInfo.cpu || `${navigator.hardwareConcurrency || 4} cores`,
          ram: electronInfo.ram || `${(navigator as any).deviceMemory || 8}GB`,
          gpu: electronInfo.gpu || "Not detected",
        };
      } else {
        console.log("🌐 Using browser fallback device info...");
        deviceInfo = {
          os: navigator.platform || "Unknown OS",
          cpu: `${navigator.hardwareConcurrency || 4} cores`,
          ram: `${(navigator as any).deviceMemory || 8}GB`,
          gpu: "WebGL GPU",
        };
      }

      const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const registerRes = await fetch(`${API_BASE}/api/worker/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId,
          os: deviceInfo.os,
          cpu: deviceInfo.cpu,
          ram: deviceInfo.ram,
          gpu: deviceInfo.gpu,
        }),
      });

      const workerData = await registerRes.json();
      if (!registerRes.ok)
        throw new Error(workerData.message || "Worker registration failed");

      const workerObj: WorkerType = {
        _id: workerData.worker._id,
        deviceId: workerData.worker.deviceId,
        currentStatus: workerData.worker.currentStatus || "online",
        status: workerData.worker.currentStatus || "online",
        os: deviceInfo.os,
        cpu: deviceInfo.cpu,
        ram: deviceInfo.ram,
        gpu: deviceInfo.gpu,
        lastHeartbeatAt: Date.now(),
        createdAt: workerData.worker.createdAt || new Date().toISOString(),
      };

      setWorker(workerObj);
      localStorage.setItem(WORKER_KEY, JSON.stringify(workerObj));

      if (
        (window as any).worker &&
        typeof (window as any).worker.setDeviceId === "function"
      ) {
        console.log(
          "💾 Storing deviceId in Electron:",
          workerData.worker.deviceId,
        );
        await (window as any).worker.setDeviceId(workerData.worker.deviceId);
      }

      setIsLoading(true);
      setTimeout(() => {
        setCurrentView("dashboard");
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      console.error("Worker registration failed:", err);
      throw err;
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setWorker(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKER_KEY);
    localStorage.removeItem("dtrain_worker_user");
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("hero");
      setIsLoading(false);
    }, 800);
  };

  const handleSwitchToSignUp = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("signup");
      setIsLoading(false);
    }, 800);
  };

  const handleSwitchToSignIn = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("signin");
      setIsLoading(false);
    }, 800);
  };

  const handleJobStart = (jobId: string) => {
    setCurrentJobId(jobId);
    if (socket && jobId) {
      socket.emit("join_job", { jobId });
      console.log(`🚪 Worker joined room for job: ${jobId}`);
    }
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("runningJob");
      setIsLoading(false);
    }, 500);
  };

  const handleJobComplete = (job: Job) => {
    if (socket && currentJobId) {
      socket.emit("leave_job", { jobId: currentJobId });
      console.log(`🚪 Worker left room for job: ${currentJobId}`);
    }
    setCompletedJob(job);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("jobDetail");
      setIsLoading(false);
    }, 500);
  };

  const handleBackToDashboard = () => {
    if (socket && (currentJobId || completedJob?._id)) {
      const jobId = currentJobId || completedJob?._id;
      socket.emit("leave_job", { jobId });
      console.log(`🚪 Worker left room for job: ${jobId}`);
    }
    setCurrentJobId(null);
    setCompletedJob(null);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("dashboard");
      setIsLoading(false);
    }, 800);
  };

  const handleViewJobDetails = (jobId: string) => {
    setCurrentJobId(jobId);
    setCompletedJob(null);
    if (socket && jobId) {
      socket.emit("join_job", { jobId });
      console.log(`🚪 Worker joined room for job: ${jobId}`);
    }
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("jobDetail");
      setIsLoading(false);
    }, 500);
  };

  const pageVariants: Variants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 1.05, y: -20 },
  };

  const pageTransition = {
    duration: 0.4,
    ease: "easeOut" as const,
  };

  return (
    <div className="min-h-screen bg-[#FFEFE1] text-slate-900 overflow-hidden">
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FFEFE1] z-50 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-4 rounded-full border-[4px] border-slate-900 bg-[#FFD447]"
                />
                <motion.div
                  animate={{
                    scale: [1, 0.8, 1],
                    backgroundColor: ["#FF76B8", "#7CF2D0", "#FF76B8"],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-8 rounded-full border-[3px] border-slate-900"
                />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center px-6 py-3 rounded-[16px] border-[3px] border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
              >
                <span className="text-lg font-extrabold text-slate-900 mr-2">
                  Loading DTrain Worker
                </span>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.span
                    key={i}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      repeatDelay: 0.2,
                      delay,
                    }}
                    className="text-xl"
                  >
                    .
                  </motion.span>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}

        {!isLoading && currentView === "dockerCheck" && (
          <motion.div
            key="dockerCheck"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <DockerGate
              onDockerReady={() => {
                if (isAuthenticated && worker) {
                  setCurrentView("dashboard");
                } else {
                  setCurrentView("hero");
                }
              }}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "hero" && (
          <motion.div
            key="hero"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <HeroSection
              onGetStarted={handleGetStarted}
              onDocumentation={handleDocumentation}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "documentation" && (
          <motion.div
            key="documentation"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Documentation onBack={handleBackToHero} />
          </motion.div>
        )}

        {!isLoading && currentView === "signin" && (
          <motion.div
            key="signin"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <SignIn
              onSignIn={handleSignIn}
              onSwitchToSignUp={handleSwitchToSignUp}
              onBack={handleBackToHero}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "signup" && (
          <motion.div
            key="signup"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <SignUp
              onSignUp={handleSignUp}
              onSwitchToSignIn={handleSwitchToSignIn}
              onBack={handleBackToHero}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "workerRegister" && (
          <motion.div
            key="workerRegister"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <WorkerRegistration
              onRegister={handleWorkerRegister}
              onSignOut={handleSignOut}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "dashboard" && (
          <motion.div
            key="dashboard"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <WorkerDashboard
              worker={worker}
              onJobStart={handleJobStart}
              onViewJobDetails={handleViewJobDetails}
              onAcceptJob={handleJobStart}
              onSignOut={handleSignOut}
              onRegisterWorker={() => setCurrentView("workerRegister")}
              socket={socket}
            />
          </motion.div>
        )}

        {!isLoading &&
          currentView === "runningJob" &&
          currentJobId &&
          worker && (
            <motion.div
              key="runningJob"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <RunningJobs
                jobId={currentJobId}
                workerId={worker.deviceId}
                onJobComplete={handleJobComplete}
                onBack={handleBackToDashboard}
                socket={socket}
              />
            </motion.div>
          )}

        {!isLoading &&
          currentView === "jobDetail" &&
          (completedJob || currentJobId) && (
            <motion.div
              key="jobDetail"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              {completedJob ? (
                <JobDetail job={completedJob} onBack={handleBackToDashboard} />
              ) : (
                <JobDetail
                  jobId={currentJobId!}
                  workerId={worker?.deviceId || ""}
                  onBack={handleBackToDashboard}
                  onAcceptJob={handleJobStart}
                />
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

export default App;
