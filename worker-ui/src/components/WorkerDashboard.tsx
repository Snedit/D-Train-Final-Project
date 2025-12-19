import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Cpu,  
  Activity, 
  CheckCircle, 
  Clock, 
  PlayCircle,
  LogOut,
  Zap,
  TrendingUp,
  Server,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import type { Worker } from '../types';

interface WorkerDashboardProps {
  worker: Worker | null;
  onJobStart: (jobId: string) => void;
  onSignOut: () => void;
  onRegisterWorker: () => void;
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
  onJobStart, 
  onSignOut,
  onRegisterWorker 
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

  useEffect(() => {
    if (worker) {
      fetchPendingJobs();
      fetchWorkerStats();
      
      // Poll for new jobs every 10 seconds
      const interval = setInterval(() => {
        fetchPendingJobs();
        fetchWorkerStats();
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [worker]);

  const fetchPendingJobs = async () => {
    try {
      const token = localStorage.getItem("dtrain_worker_token");
      const response = await fetch('http://localhost:5000/api/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter only pending jobs (not assigned to anyone yet)
        const pending = data.jobs.filter((job: PendingJob) => job.status === 'pending');
        setPendingJobs(pending);
        setError('');
      } else {
        console.error('Failed to fetch jobs:', response.status);
        setPendingJobs([]);
      }
    } catch (error) {
      console.error('Failed to fetch pending jobs:', error);
      setError('Failed to fetch jobs. Please check your connection.');
      setPendingJobs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchWorkerStats = async () => {
    if (!worker) return;

    try {
      const token = localStorage.getItem("dtrain_worker_token");
      
      // Fetch all jobs to calculate worker-specific stats
      const jobsResponse = await fetch('http://localhost:5000/api/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const workersResponse = await fetch('http://localhost:5000/api/worker');
      
      if (jobsResponse.ok && workersResponse.ok) {
        const jobsData = await jobsResponse.json();
        const workersData = await workersResponse.json();
        
        // Find current worker
        const currentWorker = workersData.workers.find(
          (w: Worker) => w.deviceId === worker.deviceId
        );
        
        // Calculate completed jobs by this worker
        const completedJobs = jobsData.jobs.filter(
          (job: any) => 
            job.assignedWorkerId === worker.deviceId && 
            job.status === 'completed'
        );
        
        // Calculate earnings (mock calculation - $5 per completed job)
        const totalEarned = completedJobs.length * 5.0;
        
        // Determine current status
        const hasActiveJob = jobsData.jobs.some(
          (job: any) => 
            job.assignedWorkerId === worker.deviceId && 
            (job.status === 'running' || job.status === 'assigned')
        );
        
        setStats({
          totalCompleted: completedJobs.length,
          totalEarned: totalEarned,
          currentStatus: hasActiveJob ? 'working' : (currentWorker?.status || 'idle'),
        });
      } else {
        // Set defaults if API fails
        setStats({
          totalCompleted: 0,
          totalEarned: 0,
          currentStatus: 'offline',
        });
      }
    } catch (error) {
      console.error('Failed to fetch worker stats:', error);
      setStats({
        totalCompleted: 0,
        totalEarned: 0,
        currentStatus: 'offline',
      });
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!worker) {
      alert('Please register as a worker first');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/worker/accept-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId, 
          deviceId: worker.deviceId 
        }),
      });

      if (response.ok) {
        // Refresh jobs list and stats
        await fetchPendingJobs();
        await fetchWorkerStats();
        
        // Navigate to running job view
        onJobStart(jobId);
      } else {
        const error = await response.json();
        alert(`Failed to accept job: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to accept job:', error);
      alert('Failed to accept job. Please try again.');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPendingJobs();
    fetchWorkerStats();
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
          {/* Grid background card */}
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

          {/* Main content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Top nav */}
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

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                Worker Dashboard
              </h1>
              {worker && (
                <p className="text-sm text-slate-700 font-medium">
                  Device ID: <span className="font-mono font-bold">{worker.deviceId}</span>
                </p>
              )}
            </div>

            {/* Error Message */}
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

            {/* Worker Not Registered Alert */}
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

            {/* Worker Content */}
            {worker && (
              <>
                {/* Worker Info Card */}
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-8">
                  <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    System Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#F0F9FF] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Operating System</p>
                      <p className="text-sm font-extrabold text-slate-900">{worker.os}</p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FEF3C7] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">CPU</p>
                      <p className="text-sm font-extrabold text-slate-900">{worker.cpu}</p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#DCFCE7] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">RAM</p>
                      <p className="text-sm font-extrabold text-slate-900">{worker.ram}</p>
                    </div>
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FCE7F3] p-4">
                      <p className="text-xs font-semibold text-slate-600 mb-1">GPU</p>
                      <p className="text-sm font-extrabold text-slate-900">{worker.gpu || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  {/* Status */}
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

                  {/* Completed Jobs */}
                  <motion.div 
                    whileHover={{ y: -2 }}
                    className="rounded-[18px] border-[3px] border-slate-900 bg-[#fef3c7] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-slate-900" />
                      </div>
                      <div>
                        <p className="text-2xl font-extrabold text-slate-900">{stats.totalCompleted}</p>
                        <p className="text-xs font-semibold text-slate-900">Jobs Completed</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Total Earned */}
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
                          ${stats.totalEarned.toFixed(2)}
                        </p>
                        <p className="text-xs font-semibold text-slate-900">Total Earned</p>
                      </div>
                    </div>
                  </motion.div>
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
                              onClick={() => handleAcceptJob(job._id)}
                              className="flex items-center gap-2 px-6 py-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] whitespace-nowrap"
                            >
                              <PlayCircle className="w-5 h-5" />
                              Accept Job
                            </motion.button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* If not registered, show limited view */}
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
    </div>
  );
};

export default WorkerDashboard;
