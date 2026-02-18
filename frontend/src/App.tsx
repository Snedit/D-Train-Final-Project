import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
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
import Wallet from "./components/Wallet";
import { Job, Worker } from "./types";
import { io, Socket } from "socket.io-client";

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('dtrain_token');
  if (!token) {
    return <Navigate to="/signin" replace />;
  }
  return <>{children}</>;
}

// Job Detail Wrapper to extract jobId from URL
function JobDetailWrapper({
  jobs,
  onBack
}: {
  jobs: Job[];
  onBack: () => void;
}) {
  const { jobId } = useParams<{ jobId: string }>();
  const job = jobs.find(j => j._id === jobId);

  if (!job) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-4">Job not found</h2>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-[14px] border-[3px] border-slate-900 bg-blue-400 text-white font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <JobDetail job={job} onBack={onBack} />;
}

function App() {
  const navigate = useNavigate();
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

    newSocket.on("connect", () => {
      console.log("✅ Socket.IO connected:", newSocket.id);
    });

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO disconnected:", reason);
    });

    newSocket.on("connect_error", (error) => {
      console.error("🔴 Socket.IO connection error:", error);
    });

    // ✅ Listen for job status changes
    newSocket.on("job_status_changed", (data) => {
      console.log("📡 Job status changed:", data);
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId
            ? { ...job, status: data.status, assignedWorkerId: data.assignedWorkerId }
            : job
        )
      );
    });

    // ✅ Listen for job acceptance
    newSocket.on("job_accepted", (data) => {
      console.log("📡 Job accepted by worker:", data);
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId
            ? { ...job, status: "assigned", assignedWorkerId: data.workerId }
            : job
        )
      );
    });

    // ✅ Listen for job status updates
    newSocket.on("job_status", (data) => {
      console.log("📡 Job status update:", data);
      setJobs((prevJobs) =>
        prevJobs.map((job) =>
          job._id === data.jobId ? { ...job, status: data.status } : job
        )
      );
    });

    setSocket(newSocket);

    return () => {
      console.log("🧹 Cleaning up Socket.IO connection");
      newSocket.disconnect();
    };
  }, []);

  // Fetch jobs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchJobs();
      fetchWorkers();
    }
  }, [isAuthenticated]);

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
        setJobs(data.jobs);
        console.log("✅ Jobs fetched:", data.jobs.length);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/worker", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("dtrain_token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers);
        console.log("✅ Workers fetched:", data.workers.length);
      }
    } catch (error) {
      console.error("Error fetching workers:", error);
    }
  };

  // Navigation handlers
  const handleSignIn = async (email: string, password: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/user/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("dtrain_token", data.token);
        localStorage.setItem("dtrain_user", JSON.stringify(data.user));
        setIsAuthenticated(true);
        setIsLoading(true);
        setTimeout(() => {
          navigate("/dashboard");
          setIsLoading(false);
        }, 800);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, message: "Network error" };
    }
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("dtrain_token", data.token);
        localStorage.setItem("dtrain_user", JSON.stringify(data.user));
        setIsAuthenticated(true);
        setIsLoading(true);
        setTimeout(() => {
          navigate("/dashboard");
          setIsLoading(false);
        }, 800);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("Sign up error:", error);
      return { success: false, message: "Network error" };
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("dtrain_token");
    localStorage.removeItem("dtrain_user");
    setIsAuthenticated(false);
    setJobs([]);
    setWorkers([]);
    navigate("/");
  };

  const handleJobSubmit = async (formData: FormData) => {
    try {
      const token = localStorage.getItem("dtrain_token");
      const response = await fetch("http://localhost:5000/api/jobs/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        await fetchJobs();
        setIsLoading(true);
        setTimeout(() => {
          navigate("/dashboard");
          setIsLoading(false);
        }, 800);
        return { success: true, jobId: data.jobId };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error("Job submission error:", error);
      return { success: false, message: "Network error" };
    }
  };

  const handleJobSelect = (job: Job) => {
    setIsLoading(true);
    setTimeout(() => {
      navigate(`/jobs/${job._id}`);
      setIsLoading(false);
    }, 800);
  };

  const handleBackToDashboard = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/dashboard");
      setIsLoading(false);
    }, 800);
  };

  const handleBackToSubmit = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/jobs/submit");
      setIsLoading(false);
    }, 800);
  };

  const handleViewRunning = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/jobs/running");
      setIsLoading(false);
    }, 800);
  };

  const handleViewPending = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/jobs/pending");
      setIsLoading(false);
    }, 800);
  };

  const handleViewWorkers = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/workers");
      setIsLoading(false);
    }, 800);
  };

  const handleViewWallet = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/wallet");
      setIsLoading(false);
    }, 800);
  };

  const handleViewDocumentation = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/docs");
      setIsLoading(false);
    }, 800);
  };

  const handleGetStarted = () => {
    setIsLoading(true);
    setTimeout(() => {
      navigate("/signin");
      setIsLoading(false);
    }, 800);
  };

  const pageVariants: Variants = {
    initial: {
      opacity: 0,
      y: 20,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    exit: {
      opacity: 0,
      y: -20,
    },
  };

  const pageTransition = {
    duration: 0.5,
    ease: "easeInOut",
  };

  return (
    <div className="min-h-screen bg-[#FFEFE1]">
      {isLoading && (
        <div className="fixed inset-0 bg-[#FFEFE1] z-50 flex items-center justify-center">
          <div className="relative w-24 h-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              !isLoading ? (
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
                    onViewDocs={handleViewDocumentation}
                  />
                </motion.div>
              ) : null
            }
          />

          <Route
            path="/signin"
            element={
              !isLoading ? (
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
                    onSwitchToSignUp={() => navigate("/signup")}
                  />
                </motion.div>
              ) : null
            }
          />

          <Route
            path="/signup"
            element={
              !isLoading ? (
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
                    onSwitchToSignIn={() => navigate("/signin")}
                  />
                </motion.div>
              ) : null
            }
          />

          <Route
            path="/docs"
            element={
              !isLoading ? (
                <motion.div
                  key="documentation"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={pageTransition}
                >
                  <Documentation onBack={() => navigate("/")} />
                </motion.div>
              ) : null
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {!isLoading ? (
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
                      onViewWallet={handleViewWallet}
                      onSignOut={handleSignOut}
                      socket={socket}
                      jobs={jobs}
                      workers={workers}
                    />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/jobs/submit"
            element={
              <ProtectedRoute>
                {!isLoading ? (
                  <motion.div
                    key="submit"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <JobSubmission
                      onSubmit={handleJobSubmit}
                      onBack={handleBackToDashboard}
                    />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/jobs/:jobId"
            element={
              <ProtectedRoute>
                {!isLoading ? (
                  <motion.div
                    key="detail"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <JobDetailWrapper
                      jobs={jobs}
                      onBack={handleBackToDashboard}
                    />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/jobs/running"
            element={
              <ProtectedRoute>
                {!isLoading ? (
                  <motion.div
                    key="running"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <RunningJobs
                      jobs={jobs}
                      onJobSelect={handleJobSelect}
                      onBack={handleBackToDashboard}
                    />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/jobs/pending"
            element={
              <ProtectedRoute>
                {!isLoading ? (
                  <motion.div
                    key="pending"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <PendingJobs
                      jobs={jobs}
                      onJobSelect={handleJobSelect}
                      onBack={handleBackToDashboard}
                    />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/workers"
            element={
              <ProtectedRoute>
                {!isLoading ? (
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
                ) : null}
              </ProtectedRoute>
            }
          />

          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                {!isLoading ? (
                  <motion.div
                    key="wallet"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                  >
                    <Wallet onBack={handleBackToDashboard} />
                  </motion.div>
                ) : null}
              </ProtectedRoute>
            }
          />

          {/* Fallback - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

export default App;