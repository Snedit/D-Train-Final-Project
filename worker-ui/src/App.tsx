import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import HeroSection from "./components/HeroSection";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import WorkerRegistration from "./components/WorkerRegistration";
import WorkerDashboard from "./components/WorkerDashboard";
import RunningJobs from "./components/RunningJobs";
import JobDetail from "./components/JobDetail";
import Documentation from "./components/Documentation";
import type { Worker as WorkerType, Job } from "./types";

function App() {
  const [currentView, setCurrentView] = useState<
    | "hero"
    | "signin"
    | "signup"
    | "workerRegister"
    | "dashboard"
    | "runningJob"
    | "jobDetail"
    | "documentation"
  >("hero");

  const [worker, setWorker] = useState<WorkerType | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [completedJob, setCompletedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Consistent localStorage keys
  const TOKEN_KEY = "dtrain_worker_token";
  const WORKER_KEY = "dtrain_worker";

  // Check if user is already logged in on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedWorker = localStorage.getItem(WORKER_KEY);

    if (savedToken && savedWorker) {
      setIsAuthenticated(true);
      setWorker(JSON.parse(savedWorker));
      setCurrentView("dashboard");
    }
  }, []);

  // Function to check if user already has a registered worker
  const checkExistingWorker = async (
    token: string
  ): Promise<WorkerType | null> => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/worker/my-worker",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.worker) {
          const workerObj: WorkerType = {
            _id: data.worker._id,
            deviceId: data.worker.deviceId,
            os: data.worker.systemInfo?.os || "Unknown",
            cpu: data.worker.systemInfo?.cpu || "Unknown",
            ram: data.worker.systemInfo?.ram || "Unknown",
            gpu: data.worker.systemInfo?.gpu || "N/A",
            status: data.worker.currentStatus || "online",
            lastHeartbeat: new Date(data.worker.lastHeartbeatAt).getTime(),
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
      if (isAuthenticated) {
        setCurrentView("dashboard");
      } else {
        setCurrentView("signin");
      }
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
      const loginRes = await fetch("http://localhost:5000/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(loginData.message || "Login failed");
      }

      localStorage.setItem(TOKEN_KEY, loginData.token);
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
    password: string
  ) => {
    try {
      setIsLoading(true);

      const registerRes = await fetch(
        "http://localhost:5000/api/user/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        throw new Error(registerData.message || "Registration failed");
      }

      if (registerData.token) {
        localStorage.setItem(TOKEN_KEY, registerData.token);
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

  // Worker Registration Handler
  // Worker Registration Handler
  const handleWorkerRegister = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        throw new Error("Please sign in first");
      }

      let deviceInfo: {
        os: string;
        cpu: string;
        ram: string;
        gpu: string;
      };

      // Check if we're in Electron environment
      const isElectron = (window as any).worker && typeof (window as any).worker.getDeviceInfo === 'function';
      console.log("🔍 Environment check:", {
        hasWorkerAPI: !!(window as any).worker,
        hasGetDeviceInfo: isElectron,
        userAgent: navigator.userAgent.includes('Electron') ? 'Electron' : 'Browser'
      });
      
      if (isElectron) {
        console.log("⚡ Using Electron device info...");
        const electronInfo = await (window as any).worker.getDeviceInfo();
        console.log("📥 Electron info received:", electronInfo);
        
        deviceInfo = {
          os: electronInfo.os || "Unknown OS",
          cpu: electronInfo.cpu || `${navigator.hardwareConcurrency || 4} cores`,
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

      const deviceId = `device-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log("📤 Sending device info to backend:", {
        deviceId,
        ...deviceInfo,
      });

      const registerRes = await fetch(
        "http://localhost:5000/api/worker/register",
        {
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
        }
      );

      const workerData = await registerRes.json();

      if (!registerRes.ok) {
        throw new Error(workerData.message || "Worker registration failed");
      }

      console.log("Worker registered successfully:", workerData);

      const workerObj: WorkerType = {
        _id: workerData.worker._id,
        deviceId: workerData.worker.deviceId,
        os: deviceInfo.os,
        cpu: deviceInfo.cpu,
        ram: deviceInfo.ram,
        gpu: deviceInfo.gpu,
        status: workerData.worker.currentStatus || "online",
        lastHeartbeat: Date.now(),
        createdAt: workerData.worker.createdAt || new Date().toISOString(),
      };

      setWorker(workerObj);
      localStorage.setItem(WORKER_KEY, JSON.stringify(workerObj));

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
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("runningJob");
      setIsLoading(false);
    }, 500);
  };

  const handleJobComplete = (job: Job) => {
    setCompletedJob(job);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("jobDetail");
      setIsLoading(false);
    }, 500);
  };

  const handleBackToDashboard = () => {
    setCurrentJobId(null);
    setCompletedJob(null);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("dashboard");
      setIsLoading(false);
    }, 800);
  };

  // NEW: open job detail from pending/available jobs list by jobId
  const handleViewJobDetails = (jobId: string) => {
    setCurrentJobId(jobId);
    setCompletedJob(null);
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
        {/* Loading Screen */}
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
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 0.2,
                  }}
                  className="text-xl"
                >
                  .
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 0.2,
                    delay: 0.2,
                  }}
                  className="text-xl"
                >
                  .
                </motion.span>
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 0.2,
                    delay: 0.4,
                  }}
                  className="text-xl"
                >
                  .
                </motion.span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Hero Section */}
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

        {/* Documentation */}
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

        {/* SignIn */}
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

        {/* SignUp */}
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

        {/* Worker Registration */}
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

        {/* Worker Dashboard */}
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
  onAcceptJob={handleJobStart}  // ✅ ADD THIS LINE
  onSignOut={handleSignOut}
  onRegisterWorker={() => setCurrentView("workerRegister")}
/>

          </motion.div>
        )}

        {/* Running Job */}
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
              />
            </motion.div>
          )}

        {/* Job Detail */}
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
              {/* 
                If coming from completed job flow, pass full job. 
                If coming from dashboard "View Details", pass jobId + workerId.
              */}
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
