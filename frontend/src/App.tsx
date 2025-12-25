import { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import HeroSection from "./components/HeroSection";
import Dashboard from "./components/Dashboard";
import JobSubmission from "./components/JobSubmission";
import JobDetail from "./components/JobDetail";
import RunningJobs from "./components/RunningJobs";
import PendingJobs from "./components/PendingJobs";
import ActiveWorkers from "./components/ActiveWorkers";
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import Documentation from "./components/Documentation";
import { Job, Worker } from "./types";
import { io, Socket } from "socket.io-client";

function App() {
  const [currentView, setCurrentView] = useState<
    | "hero"
    | "signin"
    | "signup"
    | "dashboard"
    | "submit"
    | "detail"
    | "running"
    | "pending"
    | "workers"
    | "documentation"
  >("hero");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("dtrain_user");

    if (savedUser) {
      setIsAuthenticated(true);
    }

    // ✅ Initialize Socket.IO with proper configuration
    console.log("🔌 Initializing Socket.IO connection...");
    const newSocket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // ✅ Socket connection handlers
    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("⚠️ Socket disconnected:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
    });

    // ✅ Listen for real-time job updates
    newSocket.on("job_status_changed", (data) => {
      console.log("📡 Job status changed:", data);

      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId
            ? {
                ...job,
                status: data.status,
                assignedWorkerId: data.assignedWorkerId,
              }
            : job
        )
      );

      // If viewing the specific job, update selectedJob too
      setSelectedJob((prevJob) => {
        if (!prevJob || prevJob._id !== data.jobId) {
          return prevJob;
        }
        return {
          ...prevJob,
          status: data.status,
          assignedWorkerId: data.assignedWorkerId,
        };
      });
    });

    newSocket.on("job_accepted", (data) => {
      console.log("📡 Job accepted:", data);

      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId
            ? {
                ...job,
                status: data.status,
                assignedWorkerId: data.workerId,
              }
            : job
        )
      );
    });

    // Legacy support
    newSocket.on("job_status", (data) => {
      console.log("📡 Job status (legacy):", data);

      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId ? { ...job, status: data.status } : job
        )
      );
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchJobs();
    fetchWorkers();

    // Set up periodic data refresh (less frequent now with Socket.io)
    const interval = setInterval(() => {
      fetchJobs();
      fetchWorkers();
    }, 30000); // Every 30 seconds instead of 15

    return () => {
      console.log("🧹 Cleaning up Socket.IO connection");
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("job_status_changed");
      newSocket.off("job_accepted");
      newSocket.off("job_status");
      newSocket.close();
      clearInterval(interval);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem("dtrain_token");
      const response = await fetch("http://localhost:5000/api/jobs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log("📋 Jobs fetched:", data.jobs?.length || 0);
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const token = localStorage.getItem("dtrain_token");
      const response = await fetch("http://localhost:5000/api/worker", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log("👷 Workers fetched:", data.workers?.length || 0);
        setWorkers(data.workers);
      }
    } catch (error) {
      console.error("Failed to fetch workers:", error);
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
    }, 1000);
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
      const res = await fetch("http://localhost:5000/api/user/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("dtrain_token", data.token);

      const user = {
        email,
        name: data.user?.name || email.split("@")[0],
      };
      localStorage.setItem("dtrain_user", JSON.stringify(user));

      setIsAuthenticated(true);

      setIsLoading(true);
      setTimeout(() => {
        setCurrentView("dashboard");
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        throw new Error(registerData.message || "Registration failed");
      }

      if (registerData.token) {
        localStorage.setItem("dtrain_token", registerData.token);

        const user = { name, email };
        localStorage.setItem("dtrain_user", JSON.stringify(user));

        setIsAuthenticated(true);

        setTimeout(() => {
          setCurrentView("dashboard");
          setIsLoading(false);
        }, 800);
      } else {
        const loginRes = await fetch("http://localhost:5000/api/user/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const loginData = await loginRes.json();

        if (!loginRes.ok) {
          throw new Error(loginData.message || "Auto-login failed");
        }

        localStorage.setItem("dtrain_token", loginData.token);

        const user = { name, email };
        localStorage.setItem("dtrain_user", JSON.stringify(user));

        setIsAuthenticated(true);

        setTimeout(() => {
          setCurrentView("dashboard");
          setIsLoading(false);
        }, 800);
      }
    } catch (err: any) {
      setIsLoading(false);
      throw err;
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("dtrain_user");
    localStorage.removeItem("dtrain_token");

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

  const handleJobSubmitted = () => {
    setIsLoading(true);
    fetchJobs();
    setTimeout(() => {
      setCurrentView("dashboard");
      setIsLoading(false);
    }, 800);
  };

  const handleJobSelect = (job: Job) => {
    setIsLoading(true);
    setSelectedJob(job);

    // ✅ Join job room for real-time updates
    if (socket && job._id) {
      socket.emit("join_job", { jobId: job._id });
      console.log(`🚪 Joined room for job: ${job._id}`);
    }

    setTimeout(() => {
      setCurrentView("detail");
      setIsLoading(false);
    }, 800);
  };

  const handleBackToDashboard = () => {
    setIsLoading(true);

    // ✅ Leave job room when going back
    if (socket && selectedJob?._id) {
      socket.emit("leave_job", { jobId: selectedJob._id });
      console.log(`🚪 Left room for job: ${selectedJob._id}`);
    }

    setSelectedJob(null);
    setTimeout(() => {
      setCurrentView("dashboard");
      setIsLoading(false);
    }, 800);
  };

  const handleBackToSubmit = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("submit");
      setIsLoading(false);
    }, 800);
  };

  const handleViewRunning = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("running");
      setIsLoading(false);
    }, 800);
  };

  const handleViewPending = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("pending");
      setIsLoading(false);
    }, 800);
  };

  const handleViewWorkers = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView("workers");
      setIsLoading(false);
    }, 800);
  };

  const pageVariants: Variants = {
    initial: {
      opacity: 0,
      scale: 0.95,
      y: 20,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      scale: 1.05,
      y: -20,
    },
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
                  Loading DTrain
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

        {!isLoading && currentView === "submit" && (
          <motion.div
            key="submit"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <JobSubmission
              onJobSubmitted={handleJobSubmitted}
              onBackToDashboard={handleBackToDashboard}
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
            <Dashboard
              onJobSelect={handleJobSelect}
              onNewJob={handleBackToSubmit}
              onViewRunning={handleViewRunning}
              onViewPending={handleViewPending}
              onViewWorkers={handleViewWorkers}
              onSignOut={handleSignOut}
              socket={socket}
              jobs={jobs}
              workers={workers}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "detail" && selectedJob && (
          <motion.div
            key="detail"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <JobDetail
              job={selectedJob}
              onBack={handleBackToDashboard}
              socket={socket}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "running" && (
          <motion.div
            key="running"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <RunningJobs
              jobs={jobs.filter(
                (job) => job.status === "running" || job.status === "assigned"
              )}
              onJobSelect={handleJobSelect}
              onBack={handleBackToDashboard}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "pending" && (
          <motion.div
            key="pending"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <PendingJobs
              jobs={jobs.filter(
                (job) => job.status === "pending" || job.status === "queued"
              )}
              onJobSelect={handleJobSelect}
              onBack={handleBackToDashboard}
            />
          </motion.div>
        )}

        {!isLoading && currentView === "workers" && (
          <motion.div
            key="workers"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <ActiveWorkers
              workers={workers}
              jobs={jobs}
              onBack={handleBackToDashboard}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;