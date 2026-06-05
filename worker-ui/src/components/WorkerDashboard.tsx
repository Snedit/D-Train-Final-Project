import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import {
  Cpu,
  Activity,
  CheckCircle,
  Clock,
  FileText,
  LogOut,
  Zap,
  TrendingUp,
  Server,
  AlertCircle,
  RefreshCw,
  Wallet,
  Settings
} from 'lucide-react';
import type { Worker, Pricing, Wallet as WalletType, Transaction } from '../types';
import PricingSettings from './PricingSettings';
import WalletCard from './WalletCard';
import PayoutRequest from './PayoutRequest';

interface WorkerDashboardProps {
  worker: Worker | null;
  onJobStart: (jobId: string) => void;
  onViewJobDetails: (jobId: string) => void;
  onAcceptJob: (jobId: string) => void;
  onSignOut: () => void;
  onRegisterWorker: () => void;
  socket: Socket | null;
}

interface PendingJob {
  _id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

interface WorkerStats {
  totalCompleted: number;
  totalEarned: number;
  currentStatus: 'idle' | 'working' | 'busy' | 'offline';
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({
  worker,
  onViewJobDetails,
  onSignOut,
  onRegisterWorker,
  socket
}) => {
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<WorkerStats>({
    totalCompleted: 0,
    totalEarned: 0,
    currentStatus: 'idle',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPricingSettings, setShowPricingSettings] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [walletData, setWalletData] = useState<WalletType>({
    balance: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pricing, setPricing] = useState<Pricing>({
    hourlyRate: 0.10,
    minimumCharge: 0.05,
    currency: 'INR',
  });

  // Listen for Socket.io events
  useEffect(() => {
    if (!socket) return;

    console.log('🔌 WorkerDashboard: Setting up socket listeners');

    const handleJobAccepted = (data: any) => {
      console.log('📡 WorkerDashboard: Job accepted by another worker:', data);
      setPendingJobs(prev => prev.filter(job => job._id !== data.jobId));
    };

    const handleJobStatusChanged = (data: any) => {
      console.log('📡 WorkerDashboard: Job status changed:', data);
      if (data.status === 'pending' || data.status === 'queued') {
        fetchPendingJobs();
      } else if (data.status === 'assigned' || data.status === 'completed') {
        setPendingJobs(prev => prev.filter(job => job._id !== data.jobId));
      }
    };

    socket.on('job_accepted', handleJobAccepted);
    socket.on('job_status_changed', handleJobStatusChanged);

    const handleWindowJobAccepted = (event: any) => {
      const data = event.detail;
      console.log('📡 WorkerDashboard: Window event - job accepted:', data);
      setPendingJobs(prev => prev.filter(job => job._id !== data.jobId));
    };

    window.addEventListener('job_accepted', handleWindowJobAccepted);

    return () => {
      socket.off('job_accepted', handleJobAccepted);
      socket.off('job_status_changed', handleJobStatusChanged);
      window.removeEventListener('job_accepted', handleWindowJobAccepted);
    };
  }, [socket]);

  useEffect(() => {
    if (worker) {
      console.log("✅ Worker loaded:", worker);
      fetchPendingJobs();
      fetchWorkerStats();
      fetchWalletAndPricing();

      const interval = setInterval(() => {
        fetchPendingJobs();
        fetchWorkerStats();
        fetchWalletAndPricing();
      }, 30000);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [worker]);

  const fetchPendingJobs = async () => {
    try {
      if (!worker?.deviceId) {
        setPendingJobs([]);
        setLoading(false);
        setError('Worker device ID missing. Please re-register.');
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/worker/available-jobs?deviceId=${worker.deviceId}`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const availableJobs = data.jobs || data.availableJobs || [];
        setPendingJobs(availableJobs);
        setError('');
      } else {
        const errorText = await response.text();
        console.error('❌ Jobs fetch failed:', response.status, errorText);
        setPendingJobs([]);
        if (response.status === 404) {
          setError('Worker not registered. Please register first.');
        } else {
          setError('Failed to load jobs');
        }
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      setError('Connection error. Check if backend is running on port 5000.');
      setPendingJobs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // ✅ FIXED: fetchWorkerStats now uses the /earnings endpoint which has
  // real totalJobsCompleted and totalEarnings from the Worker schema,
  // instead of counting jobs manually with a hardcoded ₹5 per job.
  const fetchWorkerStats = async () => {
    if (!worker?.deviceId) return;

    try {
      const token = localStorage.getItem("dtrain_worker_token");
      if (!token) {
        setStats({ totalCompleted: 0, totalEarned: 0, currentStatus: 'idle' });
        return;
      }

      // ✅ Use the dedicated /earnings endpoint — it returns totalJobsCompleted
      // and totalEarnings directly from the Worker document
      const earningsRes = await fetch('http://localhost:5000/api/worker/earnings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();

        // ✅ Check if this worker has any currently active jobs
        // so we can show "working" vs "idle" status
        const hasActiveJob = earningsData.inProgressJobs?.length > 0;

        setStats({
          totalCompleted: earningsData.totalJobsCompleted ?? 0,
          totalEarned: earningsData.totalEarnings ?? 0,
          currentStatus: hasActiveJob ? 'working' : 'idle',
        });
      }
    } catch (error) {
      console.error('Stats fetch failed:', error);
    }
  };

  const fetchWalletAndPricing = async () => {
    try {
      const token = localStorage.getItem("dtrain_worker_token");
      if (!token) return;

      const pricingRes = await fetch('http://localhost:5000/api/worker/pricing', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (pricingRes.ok) {
        const data = await pricingRes.json();
        if (data.pricing) setPricing(data.pricing);
      }

      const walletRes = await fetch('http://localhost:5000/api/worker/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (walletRes.ok) {
        const data = await walletRes.json();
        setWalletData({
          balance: data.walletBalance || 0,
          totalEarnings: data.totalEarnings || 0,
          pendingEarnings: data.pendingEarnings || 0,
        });
        if (data.transactions) setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Wallet fetch failed:', error);
    }
  };

  const handleUpdatePricing = async (rate: number, minCharge: number) => {
    const token = localStorage.getItem("dtrain_worker_token");
    if (!token) throw new Error("Not authenticated");

    const res = await fetch('http://localhost:5000/api/worker/pricing', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ hourlyRate: rate, minimumCharge: minCharge })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Failed to update pricing");
    }

    const data = await res.json();
    setPricing(data.pricing);
    fetchPendingJobs();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPendingJobs();
    fetchWorkerStats();
    fetchWalletAndPricing();
  };

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
          </div>
          <p className="text-lg font-extrabold text-slate-900">Loading worker dashboard...</p>
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
                'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          />

          {/* Memphis shapes */}
          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Server className="w-8 h-8 text-slate-900" />
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />

          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Nav */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img
                    src="logo.png"
                    alt="DTrain Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">
                  DTrain
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Pricing */}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={() => setShowPricingSettings(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-[#FEF3C7] text-slate-900 text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Pricing</span>
                </motion.button>

                {/* Wallet */}
                {worker && (
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                    onClick={() => setShowWalletModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-[#FFD447] text-slate-900 text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5"
                  >
                    <Wallet className="w-4 h-4" />
                    <span className="hidden sm:inline">Wallet</span>
                  </motion.button>
                )}

                {/* Refresh */}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </motion.button>

                {/* Sign Out */}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={onSignOut}
                  className="flex items-center gap-2 px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </motion.button>
              </div>
            </nav>

            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                Worker Dashboard
              </h1>
              {worker && (
                <p className="text-sm text-slate-700 font-medium">
                  Device ID: <span className="font-mono font-bold">{worker.deviceId}</span>
                  {socket?.connected && (
                    <span className="ml-3 inline-flex items-center gap-1 text-xs text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Connected
                    </span>
                  )}
                </p>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 rounded-[18px] border-[3px] border-slate-900 bg-[#FEE2E2] mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-slate-900">{error}</p>
              </motion.div>
            )}

            {!worker && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[22px] border-[3px] border-slate-900 bg-[#FEF3C7] p-6 mb-8 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[12px] bg-white border-[3px] border-slate-900 flex items-center justify-center flex-shrink-0 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <AlertCircle className="w-6 h-6 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                      Worker Not Registered
                    </h3>
                    <p className="text-sm text-slate-700 font-medium mb-4">
                      You haven't registered as a worker yet. Register your device to start accepting and processing training jobs.
                    </p>
                    <motion.button
                      whileHover={{ y: -2 }}
                      whileTap={{ y: 0 }}
                      onClick={onRegisterWorker}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-[12px] border-[3px] border-slate-900 bg-[#4ADE80] text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5"
                    >
                      <Server className="w-4 h-4" />
                      Register as Worker
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {worker && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  {/* Current Status */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-[18px] border-[3px] border-slate-900 bg-[#dcfce7] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-slate-900" />
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-900 capitalize">
                          {stats.currentStatus}
                        </p>
                        <p className="text-xs font-semibold text-slate-900">Current Status</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Jobs Completed — ✅ now reads from worker.totalJobsCompleted via /earnings */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-[18px] border-[3px] border-slate-900 bg-[#fef3c7] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-slate-900" />
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-900">
                          {stats.totalCompleted}
                        </p>
                        <p className="text-xs font-semibold text-slate-900">Jobs Completed</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Total Earnings — ✅ renamed from "Session Earnings", uses real totalEarnings */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="rounded-[18px] border-[3px] border-slate-900 bg-[#fce7f3] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-slate-900" />
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-900">
                          ₹{stats.totalEarned.toFixed(2)}
                        </p>
                        {/* ✅ Renamed from "Session Earnings" to "Total Earnings" */}
                        <p className="text-xs font-semibold text-slate-900">Total Earnings</p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* System Info */}
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-8">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    System Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#F0F9FF] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Operating System</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {(worker as any).os || (worker as any).systemInfo?.os || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FEF3C7] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">CPU</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {(worker as any).cpu || (worker as any).systemInfo?.cpu || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#DCFCE7] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">RAM</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {(worker as any).ram || (worker as any).systemInfo?.ram || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FCE7F3] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">GPU</p>
                      <p className="text-sm font-extrabold text-slate-900">
                        {(worker as any).gpu || (worker as any).systemInfo?.gpu || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Available Jobs */}
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
                  <div className="p-5 border-b-[3px] border-slate-900 bg-[#DBEAFE]">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Available Jobs ({pendingJobs.length})
                    </h2>
                  </div>

                  {pendingJobs.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-[14px] bg-[#7CF2D0] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                        <Clock className="w-8 h-8 text-slate-900" />
                      </div>
                      <p className="text-slate-700 font-semibold mb-2">No jobs available</p>
                      <p className="text-sm text-slate-600">Check back soon for new training jobs</p>
                    </div>
                  ) : (
                    <div className="p-5 space-y-4">
                      {pendingJobs.map((job, index) => (
                        <motion.div
                          key={job._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="rounded-[16px] border-[3px] border-slate-900 bg-[#FFFDF8] p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-extrabold text-slate-900 mb-1">
                                {job.title || `Training Job #${index + 1}`}
                              </h3>
                              <p className="text-sm text-slate-600 font-medium mb-3">
                                {job.description || 'Machine learning training task'}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                <Clock className="w-4 h-4" />
                                Posted {new Date(job.createdAt).toLocaleString()}
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ y: -2 }}
                              whileTap={{ y: 0 }}
                              onClick={() => onViewJobDetails(job._id)}
                              className="flex items-center gap-2 px-6 py-3 rounded-[12px] border-[3px] border-slate-900 bg-[#7CF2D0] text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] whitespace-nowrap"
                            >
                              <FileText className="w-5 h-5" />
                              View Details
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!worker && (
              <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-12 text-center">
                <div className="w-20 h-20 rounded-[16px] bg-[#E0E7FF] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <Server className="w-10 h-10 text-slate-900" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                  Register to View Jobs
                </h3>
                <p className="text-slate-600 font-medium mb-6">
                  Register as a worker to view and accept available training jobs
                </p>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={onRegisterWorker}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#4ADE80] text-slate-900 font-bold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5"
                >
                  <Server className="w-5 h-5" />
                  Register Now
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Settings Modal */}
      <PricingSettings
        isOpen={showPricingSettings}
        onClose={() => setShowPricingSettings(false)}
        currentRate={pricing.hourlyRate}
        currentMinCharge={pricing.minimumCharge}
        onUpdate={handleUpdatePricing}
      />

      {/* Payout Request Modal */}
      <AnimatePresence>
        {showPayoutModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <PayoutRequest
              walletBalance={walletData.balance}
              hasStripeAccount={!!worker?.stripeAccountId}
              onPayoutSuccess={(newBalance) => {
                setWalletData(prev => ({ ...prev, balance: newBalance }));
                setShowPayoutModal(false);
              }}
              onClose={() => setShowPayoutModal(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg"
          >
            <WalletCard
              balance={walletData.balance}
              totalEarnings={walletData.totalEarnings}
              pendingEarnings={walletData.pendingEarnings}
              transactions={transactions}
              hasStripeAccount={!!worker?.stripeAccountId}
              onRequestPayout={() => { setShowWalletModal(false); setShowPayoutModal(true); }}
              onClose={() => setShowWalletModal(false)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;