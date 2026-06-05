import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Activity, Cpu, HardDrive, IndianRupee,
  Clock, FileCode, CheckCircle, Search, Info, Download,
  Package, Rocket, Play, FileText, Cloud, Link, Trash2,
  PartyPopper, XCircle, AlertTriangle, Smartphone, Bot
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Job } from '../types';
import { Socket } from 'socket.io-client';
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  socket: Socket | null;
}

const iconMap: Record<string, React.ReactNode> = {
  '[SEARCH]': <Search className="inline w-3 h-3 mr-1" />,
  '[OK]': <CheckCircle className="inline w-3 h-3 mr-1" />,
  '[INFO]': <Info className="inline w-3 h-3 mr-1" />,
  '[DOWNLOAD]': <Download className="inline w-3 h-3 mr-1" />,
  '[EXTRACT]': <Package className="inline w-3 h-3 mr-1" />,
  '[DOCKER]': <Package className="inline w-3 h-3 mr-1" />,
  '[RUN]': <Play className="inline w-3 h-3 mr-1" />,
  '[START]': <Rocket className="inline w-3 h-3 mr-1" />,
  '[OUTPUT]': <FileText className="inline w-3 h-3 mr-1" />,
  '[FILE]': <FileText className="inline w-3 h-3 mr-1" />,
  '[CLOUD]': <Cloud className="inline w-3 h-3 mr-1" />,
  '[UPLOAD]': <Cloud className="inline w-3 h-3 mr-1" />,
  '[LINK]': <Link className="inline w-3 h-3 mr-1" />,
  '[CLEAN]': <Trash2 className="inline w-3 h-3 mr-1" />,
  '[SUCCESS]': <PartyPopper className="inline w-3 h-3 mr-1" />,
  '[ERROR]': <XCircle className="inline w-3 h-3 mr-1" />,
  '[WARN]': <AlertTriangle className="inline w-3 h-3 mr-1" />,
  '[DEVICE]': <Smartphone className="inline w-3 h-3 mr-1" />,
  '[WORKER]': <Bot className="inline w-3 h-3 mr-1" />,
  '[PACKAGE]': <Package className="inline w-3 h-3 mr-1" />,
  '[CLIPBOARD]': <Info className="inline w-3 h-3 mr-1" />,
};

const parseLogLine = (line: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\[(SEARCH|OK|INFO|DOWNLOAD|EXTRACT|DOCKER|RUN|START|OUTPUT|FILE|CLOUD|UPLOAD|LINK|CLEAN|SUCCESS|ERROR|WARN|DEVICE|WORKER|PACKAGE|CLIPBOARD)\]/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) parts.push(line.substring(lastIndex, match.index));
    parts.push(<span key={match.index} className="inline-flex items-center">{iconMap[match[0]]}</span>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) parts.push(line.substring(lastIndex));
  return parts.length > 0 ? parts : line;
};

interface LiveMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  cost: number;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack, socket }) => {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<LiveMetric[]>([]);
  const [jobStatus, setJobStatus] = useState(job.status);
  const [modelUrl, setModelUrl] = useState<string | undefined>(job.modelUrl);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // ── Single source of truth for cost/elapsed ──────────────────────
  const [liveCost, setLiveCost] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);

  // Refs — never stale inside callbacks
  const liveCostRef      = useRef<number>(0);
  const jobStatusRef     = useRef<string>(job.status);
  const startTimeRef     = useRef<Date | null>(
    job.pricing?.startTime ? new Date((job.pricing as any).startTime) : null
  );
  const workerRateRef    = useRef<number>((job.pricing as any)?.workerRate || 2.0);
  const gpuMultiplierRef = useRef<number>((job.pricing as any)?.gpuMultiplier || 1.0);
  const receivedSocketCost = useRef(false); // true once first job:cost_update arrives

  const localTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalRef    = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  const updateLiveCost = (val: number) => {
    liveCostRef.current = val;
    setLiveCost(val);
  };
  type JobStatus = 'pending' | 'queued' | 'assigned' | 'processing' | 'running' | 'completed' | 'failed' | 'cancelled';
  const updateJobStatus = (val: string) => {
    jobStatusRef.current = val;
    setJobStatus(val as JobStatus);
  };

  // Stop local ticker
  const stopTicker = () => {
    if (localTickerRef.current) {
      clearInterval(localTickerRef.current);
      localTickerRef.current = null;
    }
  };

  // ── 1. Fetch initial logs + seed pricing refs ─────────────────────
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoadingLogs(true);
        const token = localStorage.getItem('dtrain_token');
        const res = await fetch(`http://localhost:5000/api/jobs/${job._id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTerminalOutput(data.logs || []);
          updateJobStatus(data.status || job.status);

          // Seed pricing refs from fresh data
          if (data.pricing?.startTime)    startTimeRef.current    = new Date(data.pricing.startTime);
          if (data.pricing?.workerRate)   workerRateRef.current   = data.pricing.workerRate;
          if (data.pricing?.gpuMultiplier) gpuMultiplierRef.current = data.pricing.gpuMultiplier;

          // If already completed, seed cost/elapsed immediately — no blank state
          if (data.status === 'completed') {
            if (data.pricing?.actualCost)     updateLiveCost(data.pricing.actualCost);
            if (data.pricing?.durationSeconds) setLiveElapsed(data.pricing.durationSeconds);
          }
        }
      } catch {
        setTerminalOutput(['[ERROR] Failed to load logs']);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [job._id]);

  // ── 2. Fetch modelUrl if completed and not on prop ────────────────
  useEffect(() => {
    if (job.status === 'completed' && !modelUrl) {
      (async () => {
        try {
          const token = localStorage.getItem('dtrain_token');
          const res = await fetch(`http://localhost:5000/api/jobs/${job._id}/results`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.modelUrl) setModelUrl(data.modelUrl);
          }
        } catch (_) {}
      })();
    }
  }, [job._id, job.status]);

  // ── 3. Historical metrics for completed jobs ──────────────────────
  // Runs when jobStatus flips to 'completed' (from socket or initial load)
  useEffect(() => {
    if (jobStatus !== 'completed') return;

    const fetchHistoricalMetrics = async () => {
      try {
        const token = localStorage.getItem('dtrain_token');

        // Re-fetch logs to get fresh actualCost (job prop may be stale)
        const logsRes = await fetch(`http://localhost:5000/api/jobs/${job._id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let finalCost = (job.pricing as any)?.actualCost ?? 0;
        let finalDuration = (job.pricing as any)?.durationSeconds ?? 0;
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          if (logsData.pricing?.actualCost)      finalCost     = logsData.pricing.actualCost;
          if (logsData.pricing?.durationSeconds) finalDuration = logsData.pricing.durationSeconds;
        }

        // Update displayed values
        if (finalCost > 0)    updateLiveCost(finalCost);
        if (finalDuration > 0) setLiveElapsed(finalDuration);

        // Fetch billing snapshots for cpu/ram chart
        const billRes = await fetch(`http://localhost:5000/api/jobs/${job._id}/bill`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let points: LiveMetric[] = [];
        if (billRes.ok) {
          const billData = await billRes.json();
          const snapshots = (billData.breakdown || []).filter((b: any) => b.cpu > 0 || b.ram > 0);
          if (snapshots.length >= 2) {
            points = snapshots.map((b: any, idx: number) => ({
              timestamp: b.createdAt || new Date().toISOString(),
              cpu:    b.cpu ?? 0,
              memory: b.ram ?? 0,
              cost: parseFloat((finalCost * (idx / Math.max(snapshots.length - 1, 1))).toFixed(4)),
            }));
          }
        }

        // Fallback: at least show a cost ramp so graph isn't blank
        if (points.length < 2) {
          const now = Date.now();
          const stepMs = finalDuration > 0 ? finalDuration * 100 : 5000;
          points = Array.from({ length: 10 }, (_, i) => ({
            timestamp: new Date(now - (9 - i) * stepMs).toISOString(),
            cpu:    0,
            memory: 0,
            cost: parseFloat((finalCost * (i / 9)).toFixed(4)),
          }));
        }

        setMetrics(points.slice(-20));
      } catch (_) {}
    };

    fetchHistoricalMetrics();
  }, [job._id, jobStatus]);

  // ── 4. Socket events ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_job', { jobId: job._id });

    // Normalize to string once — MongoDB ObjectId vs plain string was causing
    // all data.jobId !== job._id checks to silently fail, dropping all metrics
    const jid = job._id?.toString();

    const handleJobLog = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      setTerminalOutput(prev => [...prev, data.line]);
    };

    const handleJobStatus = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      updateJobStatus(data.status);
    };

    // job_accepted — worker accepted the job, NOT started yet
    // Only update status, don't seed startTime (cost hasn't started)
    const handleJobAccepted = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      if (data.pricing?.workerRate)    workerRateRef.current    = data.pricing.workerRate;
      if (data.pricing?.gpuMultiplier) gpuMultiplierRef.current = data.pricing.gpuMultiplier;
      // ✅ do NOT set startTimeRef here — cost clock hasn't started
      updateJobStatus('assigned');
    };

    // ✅ job:started — worker clicked Start, training is actually beginning NOW
    // This is when cost clock starts for the user
    const handleJobStarted = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      if (data.startTime)   startTimeRef.current    = new Date(data.startTime);
      if (data.workerRate)  workerRateRef.current   = data.workerRate;
      receivedSocketCost.current = false; // reset so local ticker runs until first cost_update
      updateJobStatus('processing');
      updateLiveCost(0);
      setLiveElapsed(0);
    };

    const handleJobCompleted = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      stopTicker();
      updateJobStatus('completed');
      if (data.modelUrl) setModelUrl(data.modelUrl);
      if (data.pricing?.actualCost)      updateLiveCost(data.pricing.actualCost);
      if (data.pricing?.durationSeconds) setLiveElapsed(data.pricing.durationSeconds);
      setTerminalOutput(prev => [
        ...prev,
        '\n[SUCCESS] JOB COMPLETED SUCCESSFULLY!',
        `[LINK] Output available at: ${data.modelUrl}`,
      ]);
    };

    const handleJobFailed = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      stopTicker();
      updateJobStatus('failed');
      setTerminalOutput(prev => [...prev, `\n[ERROR] JOB FAILED: ${data.errorMessage}`]);
    };

    // All comparisons now use .toString() — fixes metrics never appearing in graphs
    const handleMetrics = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') return;
      console.log(`[JobDetail] metrics received | cpu=${data.cpu} mem=${data.memory} jid=${jid}`);
      setMetrics(prev => {
        const updated = [...prev, {
          timestamp: data.timestamp || new Date().toISOString(),
          cpu:    data.cpu    ?? 0,
          memory: data.memory ?? 0,
          cost:   liveCostRef.current,
        }];
        return updated.slice(-20);
      });
    };

    const handleCostUpdate = (data: any) => {
      if (data.jobId?.toString() !== jid) return;
      // Guard: if job_completed already fired, ignore any trailing cost_update events
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') {
        stopTicker();
        return;
      }
      receivedSocketCost.current = true;
      updateLiveCost(data.currentCost ?? 0);
      setLiveElapsed(data.elapsedSeconds ?? 0);
      if (data.gpuMultiplier) gpuMultiplierRef.current = data.gpuMultiplier;
      if (data.effectiveRate) workerRateRef.current    = data.effectiveRate;
    };

    socket.on('job:log',            handleJobLog);
    socket.on('job_status',         handleJobStatus);
    socket.on('job_accepted',       handleJobAccepted);
    socket.on('job:started',        handleJobStarted);
    socket.on('job_completed',      handleJobCompleted);
    socket.on('job_failed',         handleJobFailed);
    socket.on('job:metrics_update', handleMetrics);
    socket.on('job:cost_update',    handleCostUpdate);

    return () => {
      socket.emit('leave_job', { jobId: job._id });
      socket.off('job:log',            handleJobLog);
      socket.off('job_status',         handleJobStatus);
      socket.off('job_accepted',       handleJobAccepted);
      socket.off('job:started',        handleJobStarted);
      socket.off('job_completed',      handleJobCompleted);
      socket.off('job_failed',         handleJobFailed);
      socket.off('job:metrics_update', handleMetrics);
      socket.off('job:cost_update',    handleCostUpdate);
    };
  }, [socket, job._id]);

  // ── 5. Local ticker — elapsed clock + cost fallback ───────────────
  // Only runs while job is active. Stops itself when status changes.
  useEffect(() => {
    stopTicker();
    // 'assigned' = worker accepted but hasn't clicked Start — no ticking yet
    // 'processing'/'running' = worker clicked Start — tick
    const isActive = jobStatus === 'processing' || jobStatus === 'running';
    if (!isActive) return;

    localTickerRef.current = setInterval(() => {
      // Stop if job finished while interval was still alive
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') {
        stopTicker();
        return;
      }
      if (!startTimeRef.current) return;

      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
      setLiveElapsed(elapsedSeconds);

      // Only compute cost locally if socket hasn't sent a real value yet
      if (!receivedSocketCost.current) {
        const elapsedHours = elapsedSeconds / 3600;
        const cost = workerRateRef.current * gpuMultiplierRef.current * elapsedHours;
        if (cost > 0) updateLiveCost(parseFloat(cost.toFixed(4)));
      }
    }, 1000);

    return stopTicker;
  }, [jobStatus]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const latestMetric = metrics[metrics.length - 1];
  const isActive     = jobStatus === 'running' || jobStatus === 'assigned' || jobStatus === 'processing';

  const finalCostDisplay = liveCost > 0
    ? liveCost
    : (job.pricing as any)?.actualCost ?? 0;

  const statusColors: Record<string, string> = {
    pending:   'bg-[#FFE66D] text-slate-900',
    assigned:  'bg-[#7BC8FF] text-slate-900',
    running:   'bg-[#7CF2D0] text-slate-900',
    completed: 'bg-[#4ADE80] text-slate-900',
    failed:    'bg-[#FEE2E2] text-slate-900',
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)`,
              backgroundSize: '26px 26px',
            }}
          />
          <motion.div className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
            <Activity className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} />
          <motion.div className="absolute top-1/3 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}>
            <Terminal className="w-8 h-8 text-slate-900" />
          </motion.div>

          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">

            {/* Nav */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img src="/logo.png" alt="DTrain Logo" className="w-8 h-8 object-contain" />
                </div>
                <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">DTrain</span>
              </div>
              <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={onBack}
                className="flex items-center px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0 transition-all">
                Back to Dashboard
              </motion.button>
            </nav>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">{job.title}</h1>
                  <p className="text-sm text-slate-700 font-medium mb-2">{job.description}</p>
                  <p className="text-xs text-slate-600 font-mono">Job ID: {job._id}</p>
                </div>
                <div className={`inline-flex items-center px-4 py-2 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${statusColors[jobStatus] || 'bg-slate-300 text-slate-900'}`}>
                  {isActive             && <Activity      className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='pending' && <Clock         className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='completed' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='failed'  && <XCircle       className="w-3 h-3 mr-1.5" />}
                  {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                </div>
              </div>
            </div>

            {/* Banners */}
            {jobStatus === 'completed' && modelUrl && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-4 px-6 py-4 rounded-[18px] border-[3px] border-slate-900 bg-[#4ADE80] shadow-[5px_5px_0_0_rgba(15,23,42,1)]">
                <PartyPopper className="w-5 h-5 text-slate-900 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Job completed successfully!</p>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">Your trained model is ready to download.</p>
                </div>
              </motion.div>
            )}
            {jobStatus === 'failed' && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-4 px-6 py-4 rounded-[18px] border-[3px] border-slate-900 bg-[#FEE2E2] shadow-[5px_5px_0_0_rgba(15,23,42,1)]">
                <XCircle className="w-5 h-5 text-red-700 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Job failed</p>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">Check the terminal output below for error details.</p>
                </div>
              </motion.div>
            )}

            {/* Terminal + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2">
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
                  <div className="flex items-center px-6 py-4 bg-[#F5F3FF] border-b-[3px] border-slate-900">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-[#fb7185] rounded-full border border-slate-900" />
                        <div className="w-3 h-3 bg-[#facc15] rounded-full border border-slate-900" />
                        <div className="w-3 h-3 bg-[#22c55e] rounded-full border border-slate-900" />
                      </div>
                      <div className="w-10 h-10 bg-slate-900 rounded-[12px] flex items-center justify-center">
                        <Terminal className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">Live Output</h3>
                        <p className="text-xs text-slate-700">{isLoadingLogs ? 'Loading logs...' : 'Real-time execution logs'}</p>
                      </div>
                    </div>
                  </div>
                  <div ref={terminalRef} className="h-96 p-4 bg-slate-900 font-mono text-xs overflow-y-auto">
                    {isLoadingLogs && terminalOutput.length === 0
                      ? <div className="text-[#7CF2D0] animate-pulse">Loading logs...</div>
                      : terminalOutput.length === 0
                        ? <div className="text-[#7CF2D0]">No logs yet. Waiting for job to start...</div>
                        : terminalOutput.map((line, i) => (
                          <div key={i} className="text-[#7CF2D0] whitespace-pre-wrap mb-1 flex items-start">
                            {parseLogLine(line)}
                          </div>
                        ))
                    }
                    {isActive && <div className="text-[#7CF2D0] animate-pulse inline-block">▋</div>}
                  </div>
                </div>
              </div>

              {/* Info sidebar */}
              <div className="space-y-6">
                <div className="rounded-[20px] border-[3px] border-slate-900 bg-white p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[12px] bg-[#7BC8FF] border-[2px] border-slate-900 flex items-center justify-center">
                      <FileCode className="w-5 h-5 text-slate-900" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Job Information</h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    {[
                      ['Status', jobStatus],
                      ['Main Entry', job.config?.entryFile],
                      ['Requirements', 'requirements.txt'],
                      ['Created', new Date(job.createdAt).toLocaleDateString()],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">{label}:</span>
                        <span className="font-mono font-bold text-slate-900">{val}</span>
                      </div>
                    ))}
                    {(job.pricing as any)?.gpuName && (job.pricing as any).gpuName !== 'N/A' && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">GPU:</span>
                        <span className="font-mono font-bold text-slate-900 text-[10px]">{(job.pricing as any).gpuName}</span>
                      </div>
                    )}
                    {(isActive || jobStatus === 'completed') && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Duration:</span>
                        <span className="font-mono font-bold text-slate-900">{formatElapsed(liveElapsed)}</span>
                      </div>
                    )}
                    {isActive && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Running Cost:</span>
                        <span className="font-mono font-bold text-green-700">₹{liveCost.toFixed(4)}</span>
                      </div>
                    )}
                    {jobStatus === 'completed' && finalCostDisplay > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Final Cost:</span>
                        <span className="font-mono font-bold text-purple-700">₹{finalCostDisplay.toFixed(4)}</span>
                      </div>
                    )}
                    {job.assignedWorkerId && (
                      <div className="flex flex-col py-2">
                        <span className="text-slate-700 font-semibold mb-1">Worker:</span>
                        <span className="font-mono text-[10px] text-slate-900 break-all bg-[#FFFDF8] p-2 rounded-lg border border-slate-200">
                          {job.assignedWorkerId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {jobStatus === 'completed' && modelUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[20px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center">
                        <Download className="w-5 h-5 text-slate-900" />
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">Model Output</h3>
                    </div>
                    <p className="text-xs text-slate-800 font-medium mb-4">Your trained model is packaged as a ZIP archive and ready to download.</p>
                    <motion.a href={modelUrl} target="_blank" rel="noopener noreferrer" whileHover={{ y: -2 }} whileTap={{ y: 0 }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-slate-900 text-white text-sm font-extrabold shadow-[3px_3px_0_0_rgba(15,23,42,0.4)] hover:shadow-[5px_5px_0_0_rgba(15,23,42,0.4)] transition-all">
                      <Download className="w-4 h-4" /> Download Model ZIP
                    </motion.a>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CPU */}
              <motion.div whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7BC8FF] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] transition-all">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">CPU Usage</h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {latestMetric
                        ? `${latestMetric.cpu < 1 ? latestMetric.cpu.toFixed(2) : Math.round(latestMetric.cpu)}%`
                        : isActive ? 'Starting...' : jobStatus === 'completed' ? 'No data' : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">from Docker stats</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cpu" stroke="#1d4ed8" fill="url(#cpuGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={(['auto', 'auto'] as any)} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Memory */}
              <motion.div whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] transition-all">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <HardDrive className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Memory Usage</h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {latestMetric
                        ? `${latestMetric.memory < 1 ? latestMetric.memory.toFixed(2) : Math.round(latestMetric.memory)}%`
                        : isActive ? 'Starting...' : jobStatus === 'completed' ? 'No data' : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">from Docker stats</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="memory" stroke="#047857" fill="url(#memGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={(['auto', 'auto'] as any)} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Cost */}
              <motion.div whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] transition-all">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <IndianRupee className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {jobStatus === 'completed' ? 'Final Cost' : 'Running Cost'}
                    </h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {isActive
                        ? `₹${liveCost.toFixed(4)}`
                        : jobStatus === 'completed' && finalCostDisplay > 0
                          ? `₹${finalCostDisplay.toFixed(4)}`
                          : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">
                      {isActive
                        ? `${formatElapsed(liveElapsed)} elapsed`
                        : jobStatus === 'completed'
                          ? `${formatElapsed(liveElapsed)} total`
                          : 'Job not started'}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cost" stroke="#7e22ce" fill="url(#costGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;