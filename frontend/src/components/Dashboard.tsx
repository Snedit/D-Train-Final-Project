import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Users,
  Activity,
  ArrowRight,
  Database,
  Plus,
  Trash2,
  Wallet,
  Send,
  IndianRupee,
  FileText,
} from "lucide-react";
import { Job, Worker } from "../types";
import ProfileDropdown from "./ProfileDropdown";
import SettingsModal from "./SettingsModal";

interface DashboardProps {
  onJobSelect: (job: Job) => void;
  onNewJob: () => void;
  onViewRunning: () => void;
  onViewPending: () => void;
  onViewWorkers: () => void;
  onViewWallet: () => void;
  onSignOut: () => void;
  jobs: Job[];
  workers: Worker[];
}

const Dashboard: React.FC<DashboardProps> = ({
  onJobSelect,
  onNewJob,
  onViewRunning,
  onViewPending,
  onViewWorkers,
  onViewWallet,
  onSignOut,
  jobs,
  workers,
}) => {
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [localJobs, setLocalJobs] = useState<Job[]>(jobs);
  const [walletBalance, setWalletBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  const handleProfileUpdated = (name: string, email: string) => {
    setUserInfo({ name, email });
  };

  const handlePublishDraft = async (job: Job) => {
    setPublishingId(job._id);
    setPublishError("");
    try {
      const token = localStorage.getItem("dtrain_token");
      const res = await fetch(
        `http://localhost:5000/api/jobs/${job._id}/publish`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      const data = await res.json();
      if (res.ok) {
        setLocalJobs((prev) =>
          prev.map((j) =>
            j._id === job._id ? { ...j, status: "pending" } : j,
          ),
        );
        setAvailableBalance(data.availableBalance ?? availableBalance);
        setWalletBalance((prev) => prev);
      } else {
        setPublishError(data.message || "Failed to publish");
      }
    } catch {
      setPublishError("Network error — please try again");
    } finally {
      setPublishingId(null);
    }
  };

  const statusIcons = {
    draft: FileText,
    pending: Clock,
    accepted: Play,
    assigned: Play,
    running: Activity,
    completed: CheckCircle,
    failed: XCircle,
  };

  const statusColors = {
    draft: "bg-slate-200 text-slate-700",
    pending: "bg-[#FFE66D] text-slate-900",
    accepted: "bg-[#7BC8FF] text-slate-900",
    assigned: "bg-[#7BC8FF] text-slate-900",
    running: "bg-[#7CF2D0] text-slate-900",
    completed: "bg-[#4ADE80] text-slate-900",
    failed: "bg-[#FEE2E2] text-slate-900",
  };

  useEffect(() => {
    setLocalJobs(jobs);
  }, [jobs]);

  useEffect(() => {
    setLoading(false);

    const savedUser = localStorage.getItem("dtrain_user");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setUserInfo({
          name: user.name || "User",
          email: user.email || "user@example.com",
        });
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        const token = localStorage.getItem("dtrain_token");
        const response = await fetch(
          "http://localhost:5000/api/payment/wallet/balance",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setWalletBalance(data.balance ?? 0);
          setAvailableBalance(data.available ?? data.balance ?? 0);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      }
    };
    fetchWalletBalance();
  }, []);

  const draftJobs = localJobs.filter((j) => j.status === "draft");
  const activeJobs = localJobs.filter((j) => j.status !== "draft");

  const activeWorkersCount = workers.filter(
    (w) =>
      w.currentStatus === "online" ||
      w.currentStatus === "busy" ||
      w.currentStatus === "idle",
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
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
          </div>
          <p className="text-lg font-extrabold text-slate-900">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />

          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Activity className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 -right-6 w-16 h-16 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <Database className="w-6 h-6 text-slate-900" />
          </motion.div>

          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img
                    src="/logo.png"
                    alt="DTrain Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">
                  DTrain
                </span>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={onNewJob}
                  className="flex items-center justify-center px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
                >
                  <Plus className="w-5 h-5 sm:hidden" />
                  <span className="hidden sm:inline">New Job</span>
                </motion.button>

                <ProfileDropdown
                  onSignOut={onSignOut}
                  onSettings={() => setShowSettings(true)}
                  userName={userInfo.name}
                  userEmail={userInfo.email}
                />
              </div>
            </nav>

            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                Training Dashboard
              </h1>
              <p className="text-sm text-slate-700 font-medium">
                Manage your distributed ML training jobs
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">
              {/* Total Jobs */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-blue-400 p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {activeJobs.length}
                    </p>
                    <p className="text-xs font-semibold text-slate-700">
                      Total Jobs
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Running Jobs */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onViewRunning}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                      <Play className="w-5 h-5 text-slate-900" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {
                          localJobs.filter(
                            (j) =>
                              j.status === "running" ||
                              j.status === "assigned" ||
                              j.status === "processing",
                          ).length
                        }
                      </p>
                      <p className="text-xs font-semibold text-slate-900">
                        Running
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>

              {/* Pending Jobs */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onViewPending}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFE66D] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-slate-900" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {
                          activeJobs.filter(
                            (j) =>
                              j.status === "pending" || j.status === "queued",
                          ).length
                        }
                      </p>
                      <p className="text-xs font-semibold text-slate-900">
                        Pending
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>

              {/* Active Workers */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onViewWorkers}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-slate-900" />
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {activeWorkersCount}
                      </p>
                      <p className="text-xs font-semibold text-slate-900">
                        Active Workers
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>

              {/* Wallet */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onViewWallet}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#A8E6CF] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-slate-900" />
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <p className="text-2xl font-extrabold text-slate-900 leading-none">
                      ₹{Math.round(availableBalance)}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-900">
                      Your Wallet
                    </p>
                    {walletBalance !== availableBalance && (
                      <p className="text-[9px] text-slate-600 font-medium">
                        ₹{Math.round(walletBalance)} total
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Drafts Section */}
            {draftJobs.length > 0 && (
              <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden mb-6">
                <div className="p-5 border-b-[3px] border-slate-900 bg-[#FFE66D] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-900" />
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Drafts
                    </h2>
                    <span className="px-2 py-0.5 rounded-full border-[2px] border-slate-900 bg-white text-xs font-bold">
                      {draftJobs.length}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Top up wallet then click Pay & Publish to send to workers
                  </p>
                </div>

                {publishError && (
                  <div className="mx-5 mt-4 px-4 py-3 rounded-[12px] border-[2px] border-slate-900 bg-[#FEE2E2] text-xs font-semibold text-slate-900">
                    ⚠ {publishError}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FFFDF8] border-b-[2px] border-slate-900">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Job
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Cost
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Created
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Action
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftJobs.map((job, index) => {
                        const tierPrice = (job.pricing as any)?.tierPrice;
                        const canAfford = availableBalance >= (tierPrice ?? 0);
                        const isPublishing = publishingId === job._id;
                        return (
                          <motion.tr
                            key={job._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="border-b-[2px] border-slate-900/10 hover:bg-[#FFFBEB] transition-colors"
                          >
                            <td className="px-5 py-4">
                              <p className="text-sm font-extrabold text-slate-900">
                                {job.title || (job as any).name}
                              </p>
                              <p className="text-xs text-slate-500 font-medium font-mono">
                                {job.config?.entryFile}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              {tierPrice ? (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <IndianRupee className="w-3.5 h-3.5 text-slate-700" />
                                  <span className="text-sm font-extrabold text-slate-900">
                                    {Math.round(tierPrice)}
                                  </span>
                                  {!canAfford && (
                                    <span className="text-[10px] font-semibold text-red-600 ml-1">
                                      (need ₹
                                      {Math.ceil(tierPrice - availableBalance)}{" "}
                                      more — top up wallet)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-700 font-medium">
                              {new Date(job.createdAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-4">
                              <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ y: 0 }}
                                onClick={() => handlePublishDraft(job)}
                                disabled={isPublishing || !canAfford}
                                className={`flex items-center gap-2 px-4 py-2 rounded-[10px] border-[2px] border-slate-900 text-xs font-extrabold shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)] ${
                                  !canAfford
                                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                    : isPublishing
                                      ? "bg-[#7CF2D0] text-slate-700 cursor-wait"
                                      : "bg-[#4ADE80] text-slate-900"
                                }`}
                              >
                                {isPublishing ? (
                                  <>
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "linear",
                                      }}
                                      className="w-3 h-3 border-[2px] border-slate-900 border-t-transparent rounded-full"
                                    />
                                    Publishing…
                                  </>
                                ) : !canAfford ? (
                                  <>Top Up First</>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" /> Pay & Publish
                                  </>
                                )}
                              </motion.button>
                            </td>
                            <td className="px-5 py-4">
                              <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ y: 0 }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm("Delete this draft?")) {
                                    try {
                                      const token =
                                        localStorage.getItem("dtrain_token");
                                      const res = await fetch(
                                        `http://localhost:5000/api/jobs/${job._id}`,
                                        {
                                          method: "DELETE",
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        },
                                      );
                                      if (res.ok)
                                        setLocalJobs((prev) =>
                                          prev.filter((j) => j._id !== job._id),
                                        );
                                    } catch {}
                                  }
                                }}
                                className="p-2 rounded-[10px] border-[2px] border-slate-900 bg-red-100 text-red-600 hover:bg-red-200 shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jobs Table */}
            <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
              <div className="p-5 border-b-[3px] border-slate-900 bg-[#F5F3FF]">
                <h2 className="text-lg font-extrabold text-slate-900">
                  Recent Jobs
                </h2>
              </div>

              {activeJobs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-slate-700 font-semibold mb-4">
                    No jobs yet
                  </p>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                    onClick={onNewJob}
                    className="px-6 py-3 rounded-[14px] border-[3px] border-slate-900 bg-blue-400 text-white font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
                  >
                    Create your first job
                  </motion.button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FFFDF8] border-b-[2px] border-slate-900">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Job
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Status
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Created
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Entry Point
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Action
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-extrabold text-slate-900">
                          Delete
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeJobs.map((job, index) => {
                        const StatusIcon =
                          statusIcons[job.status as keyof typeof statusIcons] ||
                          Clock;
                        const statusStyle =
                          statusColors[
                            job.status as keyof typeof statusColors
                          ] || statusColors.pending;

                        return (
                          <motion.tr
                            key={job._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="border-b-[2px] border-slate-900/10 hover:bg-[#F9F5FF] transition-colors"
                          >
                            <td className="px-5 py-4">
                              <p className="text-sm font-extrabold text-slate-900">
                                {job.title || job.name}
                              </p>
                              <p className="text-xs text-slate-600 font-medium">
                                #{index + 1}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <div
                                className={`inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${statusStyle}`}
                              >
                                <StatusIcon className="w-3 h-3 mr-1.5" />
                                {job.status.charAt(0).toUpperCase() +
                                  job.status.slice(1)}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-700 font-medium">
                              {new Date(job.createdAt).toLocaleString()}
                            </td>
                            <td className="px-5 py-4 text-xs text-slate-900 font-mono font-semibold">
                              {job.config?.entryFile}
                            </td>
                            <td className="px-5 py-4">
                              <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ y: 0 }}
                                onClick={() => onJobSelect(job)}
                                className="px-4 py-2 rounded-[10px] border-[2px] border-slate-900 bg-white text-slate-900 text-xs font-bold shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                              >
                                View Details
                              </motion.button>
                            </td>
                            <td className="px-5 py-4">
                              <motion.button
                                whileHover={{ y: -1 }}
                                whileTap={{ y: 0 }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      "Are you sure you want to delete this job?",
                                    )
                                  ) {
                                    try {
                                      const token =
                                        localStorage.getItem("dtrain_token");
                                      const response = await fetch(
                                        `http://localhost:5000/api/jobs/${job._id}`,
                                        {
                                          method: "DELETE",
                                          headers: {
                                            Authorization: `Bearer ${token}`,
                                          },
                                        },
                                      );

                                      if (response.ok) {
                                        setLocalJobs((prev) =>
                                          prev.filter((j) => j._id !== job._id),
                                        );
                                        console.log(
                                          `✅ Job ${job._id} deleted successfully`,
                                        );
                                      } else {
                                        const errorData = await response.json();
                                        console.error(
                                          "Delete failed:",
                                          errorData,
                                        );
                                        alert(
                                          `Failed to delete job: ${errorData.message || "Unknown error"}`,
                                        );
                                      }
                                    } catch (error) {
                                      console.error(
                                        "Error deleting job:",
                                        error,
                                      );
                                      alert(
                                        "Failed to delete job. Please try again.",
                                      );
                                    }
                                  }
                                }}
                                className="p-2 rounded-[10px] border-[2px] border-slate-900 bg-red-100 text-red-600 hover:bg-red-200 shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                                title="Delete job"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            userName={userInfo.name}
            userEmail={userInfo.email}
            tokenKey="dtrain_token"
            userKey="dtrain_user"
            onClose={() => setShowSettings(false)}
            onSignOut={onSignOut}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
