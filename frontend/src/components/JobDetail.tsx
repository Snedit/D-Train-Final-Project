import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal, Activity, Cpu, HardDrive, Clock,
  FileCode, CheckCircle, Search, Info, Download,
  Package, Rocket, Play, FileText, Cloud, Link, Trash2,
  PartyPopper, XCircle, AlertTriangle, Smartphone, Bot,
  IndianRupee
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Job } from '../types';
import { Socket } from 'socket.io-client';
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_BASE } from "../config";

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  socket: Socket | null;
}

const iconMap: Record<string, React.ReactNode> = {
  '[SEARCH]':    <Search      className="inline w-3 h-3 mr-1" />,
  '[OK]':        <CheckCircle className="inline w-3 h-3 mr-1" />,
  '[INFO]':      <Info        className="inline w-3 h-3 mr-1" />,
  '[DOWNLOAD]':  <Download    className="inline w-3 h-3 mr-1" />,
  '[EXTRACT]':   <Package     className="inline w-3 h-3 mr-1" />,
  '[DOCKER]':    <Package     className="inline w-3 h-3 mr-1" />,
  '[RUN]':       <Play        className="inline w-3 h-3 mr-1" />,
  '[START]':     <Rocket      className="inline w-3 h-3 mr-1" />,
  '[OUTPUT]':    <FileText    className="inline w-3 h-3 mr-1" />,
  '[FILE]':      <FileText    className="inline w-3 h-3 mr-1" />,
  '[CLOUD]':     <Cloud       className="inline w-3 h-3 mr-1" />,
  '[UPLOAD]':    <Cloud       className="inline w-3 h-3 mr-1" />,
  '[LINK]':      <Link        className="inline w-3 h-3 mr-1" />,
  '[CLEAN]':     <Trash2      className="inline w-3 h-3 mr-1" />,
  '[SUCCESS]':   <PartyPopper className="inline w-3 h-3 mr-1" />,
  '[ERROR]':     <XCircle     className="inline w-3 h-3 mr-1" />,
  '[WARN]':      <AlertTriangle className="inline w-3 h-3 mr-1" />,
  '[DEVICE]':    <Smartphone  className="inline w-3 h-3 mr-1" />,
  '[WORKER]':    <Bot         className="inline w-3 h-3 mr-1" />,
  '[PACKAGE]':   <Package     className="inline w-3 h-3 mr-1" />,
  '[CLIPBOARD]': <Info        className="inline w-3 h-3 mr-1" />,
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
  elapsed: number; // seconds — replaces cost
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack, socket }) => {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [metrics, setMetrics]               = useState<LiveMetric[]>([]);
  const [jobStatus, setJobStatus]           = useState(job.status);
  const [modelUrl, setModelUrl]             = useState<string | undefined>(job.modelUrl);
  const [isLoadingLogs, setIsLoadingLogs]   = useState(true);
  const [liveElapsed, setLiveElapsed]       = useState(0);

  // Tier pricing — read from job, updated via socket/fetch
  const [tierPrice, setTierPrice] = useState<number | null>((job.pricing as any)?.tierPrice ?? null);

  const jobStatusRef  = useRef<string>(job.status);
  const startTimeRef  = useRef<Date | null>(
    (job.pricing as any)?.startTime ? new Date((job.pricing as any).startTime) : null
  );
  const localTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const terminalRef    = useRef<HTMLDivElement>(null);

  const updateJobStatus = (val: string) => { jobStatusRef.current = val; setJobStatus(val as any); };
  const stopTicker = () => {
    if (localTickerRef.current) { clearInterval(localTickerRef.current); localTickerRef.current = null; }
  };

  // ── 1. Fetch initial logs ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setIsLoadingLogs(true);
        const token = localStorage.getItem('dtrain_token');
        const res = await fetch(`${API_BASE}/api/jobs/${job._id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTerminalOutput(data.logs || []);
          updateJobStatus(data.status || job.status);
          if (data.pricing?.startTime) startTimeRef.current = new Date(data.pricing.startTime);
          if (data.pricing?.tierPrice) setTierPrice(data.pricing.tierPrice);
          if (data.status === 'completed' && data.pricing?.durationSeconds)
            setLiveElapsed(data.pricing.durationSeconds);
        }
      } catch { setTerminalOutput(['[ERROR] Failed to load logs']); }
      finally  { setIsLoadingLogs(false); }
    })();
  }, [job._id]);

  // ── 2. Fetch modelUrl if completed ───────────────────────────────
  useEffect(() => {
    if (job.status !== 'completed' || modelUrl) return;
    (async () => {
      try {
        const token = localStorage.getItem('dtrain_token');
        const res = await fetch(`${API_BASE}/api/jobs/${job._id}/results`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) { const d = await res.json(); if (d.modelUrl) setModelUrl(d.modelUrl); }
      } catch (_) {}
    })();
  }, [job._id, job.status]);

  // ── 3. Historical metrics for completed jobs ─────────────────────
  useEffect(() => {
    if (jobStatus !== 'completed') return;
    (async () => {
      try {
        const token = localStorage.getItem('dtrain_token');
        const logsRes = await fetch(`${API_BASE}/api/jobs/${job._id}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let finalDuration = (job.pricing as any)?.durationSeconds ?? 0;
        if (logsRes.ok) {
          const d = await logsRes.json();
          if (d.pricing?.durationSeconds) finalDuration = d.pricing.durationSeconds;
          if (d.pricing?.tierPrice) setTierPrice(d.pricing.tierPrice);
        }
        if (finalDuration > 0) setLiveElapsed(finalDuration);

        const billRes = await fetch(`${API_BASE}/api/jobs/${job._id}/bill`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let points: LiveMetric[] = [];
        if (billRes.ok) {
          const billData = await billRes.json();
          const snapshots = (billData.breakdown || []).filter((b: any) => b.cpu > 0 || b.ram > 0);
          if (snapshots.length >= 2) {
            points = snapshots.map((b: any, idx: number) => ({
              timestamp: b.createdAt || new Date().toISOString(),
              cpu:     b.cpu ?? 0,
              memory:  b.ram ?? 0,
              elapsed: Math.round(finalDuration * (idx / Math.max(snapshots.length - 1, 1))),
            }));
          }
        }
        if (points.length < 2 && finalDuration > 0) {
          const now = Date.now();
          const stepMs = finalDuration * 100;
          points = Array.from({ length: 10 }, (_, i) => ({
            timestamp: new Date(now - (9 - i) * stepMs).toISOString(),
            cpu: 0, memory: 0,
            elapsed: Math.round(finalDuration * (i / 9)),
          }));
        }
        if (points.length > 0) setMetrics(points.slice(-20));
      } catch (_) {}
    })();
  }, [job._id, jobStatus]);

  // ── 4. Socket events ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_job', { jobId: job._id });
    const jid = job._id?.toString();

    const handleLog       = (d: any) => { if (d.jobId?.toString() !== jid) return; setTerminalOutput(p => [...p, d.line]); };
    const handleStatus    = (d: any) => { if (d.jobId?.toString() !== jid) return; updateJobStatus(d.status); };
    const handleAccepted  = (d: any) => { if (d.jobId?.toString() !== jid) return; updateJobStatus('assigned'); };
    const handleStarted   = (d: any) => {
      if (d.jobId?.toString() !== jid) return;
      if (d.startTime) startTimeRef.current = new Date(d.startTime);
      updateJobStatus('processing');
      setLiveElapsed(0);
    };
    const handleCompleted = (d: any) => {
      if (d.jobId?.toString() !== jid) return;
      stopTicker();
      updateJobStatus('completed');
      if (d.modelUrl) setModelUrl(d.modelUrl);
      if (d.pricing?.durationSeconds) setLiveElapsed(d.pricing.durationSeconds);
      if (d.pricing?.tierPrice) setTierPrice(d.pricing.tierPrice);
      setTerminalOutput(p => [...p, '\n[SUCCESS] JOB COMPLETED SUCCESSFULLY!', `[LINK] Output: ${d.modelUrl}`]);
    };
    const handleFailed    = (d: any) => {
      if (d.jobId?.toString() !== jid) return;
      stopTicker();
      updateJobStatus('failed');
      setTerminalOutput(p => [...p, `\n[ERROR] JOB FAILED: ${d.errorMessage}`]);
    };
    const handleMetrics   = (d: any) => {
      if (d.jobId?.toString() !== jid) return;
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') return;
      const elapsed = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000) : 0;
      setMetrics(p => [...p, {
        timestamp: d.timestamp || new Date().toISOString(),
        cpu: d.cpu ?? 0, memory: d.memory ?? 0, elapsed,
      }].slice(-20));
    };
    const handleTimeUpdate = (d: any) => {
      if (d.jobId?.toString() !== jid) return;
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') return;
      setLiveElapsed(d.elapsedSeconds ?? 0);
    };

    socket.on('job:log',            handleLog);
    socket.on('job_status',         handleStatus);
    socket.on('job_accepted',       handleAccepted);
    socket.on('job:started',        handleStarted);
    socket.on('job_completed',      handleCompleted);
    socket.on('job_failed',         handleFailed);
    socket.on('job:metrics_update', handleMetrics);
    socket.on('job:time_update',    handleTimeUpdate);

    return () => {
      socket.emit('leave_job', { jobId: job._id });
      socket.off('job:log', handleLog);
      socket.off('job_status', handleStatus);
      socket.off('job_accepted', handleAccepted);
      socket.off('job:started', handleStarted);
      socket.off('job_completed', handleCompleted);
      socket.off('job_failed', handleFailed);
      socket.off('job:metrics_update', handleMetrics);
      socket.off('job:time_update', handleTimeUpdate);
    };
  }, [socket, job._id]);

  // ── 5. Local elapsed ticker ──────────────────────────────────────
  useEffect(() => {
    stopTicker();
    const isActive = jobStatus === 'processing' || jobStatus === 'running';
    if (!isActive) return;
    localTickerRef.current = setInterval(() => {
      if (jobStatusRef.current === 'completed' || jobStatusRef.current === 'failed') { stopTicker(); return; }
      if (!startTimeRef.current) return;
      setLiveElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
    }, 1000);
    return stopTicker;
  }, [jobStatus]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalOutput]);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  const latestMetric = metrics[metrics.length - 1];
  const isActive     = jobStatus === 'running' || jobStatus === 'assigned' || jobStatus === 'processing';

  const statusColors: Record<string, string> = {
    pending:    'bg-[#FFE66D] text-slate-900',
    assigned:   'bg-[#7BC8FF] text-slate-900',
    running:    'bg-[#7CF2D0] text-slate-900',
    processing: 'bg-[#7CF2D0] text-slate-900',
    completed:  'bg-[#4ADE80] text-slate-900',
    failed:     'bg-[#FEE2E2] text-slate-900',
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative">
          <div className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{ backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)`, backgroundSize: '26px 26px' }} />
          <motion.div className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ rotate: [0,15,-15,0], scale: [1,1.1,1] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
            <Activity className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0,-6,0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} />
          <motion.div className="absolute top-1/3 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6,-6,6] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}>
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
                className="flex items-center px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:bg-blue-500 transition-all">
                Back to Dashboard
              </motion.button>
            </nav>

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">{job.title}</h1>
                  <p className="text-sm text-slate-700 font-medium mb-1">{job.description}</p>
                  <p className="text-xs text-slate-600 font-mono">Job ID: {job._id}</p>
                </div>
                <div className={`inline-flex items-center px-4 py-2 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${statusColors[jobStatus] || 'bg-slate-300 text-slate-900'}`}>
                  {isActive              && <Activity      className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='pending'  && <Clock         className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='completed'&& <CheckCircle   className="w-3 h-3 mr-1.5" />}
                  {jobStatus==='failed'   && <XCircle       className="w-3 h-3 mr-1.5" />}
                  {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                </div>
              </div>
            </div>

            {/* Tier price banner */}
            {tierPrice && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-center gap-3 px-5 py-3 rounded-[16px] border-[3px] border-slate-900 bg-[#FFE66D] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <IndianRupee className="w-5 h-5 text-slate-900 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    Job cost: ₹{tierPrice}
                  </p>
                  <p className="text-xs text-slate-700 font-medium">
                    {jobStatus === 'completed' ? 'Payment charged on completion.' : 'Only charged when training completes successfully.'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Status banners */}
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
                  <p className="text-sm font-extrabold text-slate-900">Job failed — no charge applied</p>
                  <p className="text-xs text-slate-800 font-medium mt-0.5">Check the terminal output for details.</p>
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

              {/* Sidebar */}
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
                      ['Status',       jobStatus],
                      ['Main Entry',   job.config?.entryFile],
                      ['Requirements', 'requirements.txt'],
                      ['Created',      new Date(job.createdAt).toLocaleDateString()],
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
                    {tierPrice && (
                      <div className="flex justify-between items-center py-2 border-b border-slate-200">
                        <span className="text-slate-700 font-semibold">Tier Price:</span>
                        <span className="font-mono font-bold text-green-700">₹{tierPrice}</span>
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
                    <p className="text-xs text-slate-800 font-medium mb-4">Your trained model is packaged and ready to download.</p>
                    <motion.a href={modelUrl} target="_blank" rel="noopener noreferrer" whileHover={{ y: -2 }} whileTap={{ y: 0 }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-slate-900 text-white text-sm font-extrabold shadow-[3px_3px_0_0_rgba(15,23,42,0.4)] hover:shadow-[5px_5px_0_0_rgba(15,23,42,0.4)] transition-all">
                      <Download className="w-4 h-4" /> Download Model ZIP
                    </motion.a>
                  </motion.div>
                )}
              </div>
            </div>

            {/* ── 3 Graphs: CPU · Memory · Time ─────────────────────────── */}
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
                        : isActive ? 'Starting...' : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">from Docker stats</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top:5, right:0, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="cpu" stroke="#1d4ed8" fill="url(#cpuGrad)" strokeWidth={2.5} dot={false} activeDot={{ r:4 }} />
                    <XAxis dataKey="timestamp" hide /><YAxis hide domain={['auto','auto'] as any} />
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
                        : isActive ? 'Starting...' : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">from Docker stats</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top:5, right:0, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#059669" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="memory" stroke="#047857" fill="url(#memGrad)" strokeWidth={2.5} dot={false} activeDot={{ r:4 }} />
                    <XAxis dataKey="timestamp" hide /><YAxis hide domain={['auto','auto'] as any} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Time — replaces cost graph */}
              <motion.div whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFD447] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)] transition-all">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {jobStatus === 'completed' ? 'Total Duration' : 'Elapsed Time'}
                    </h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {liveElapsed > 0 ? formatElapsed(liveElapsed) : isActive ? 'Starting...' : '—'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-700 mt-0.5">
                      {jobStatus === 'completed' ? 'total wall time' : 'since training started'}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={metrics.slice(-20)} margin={{ top:5, right:0, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#d97706" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="elapsed" stroke="#b45309" fill="url(#timeGrad)" strokeWidth={2.5} dot={false} activeDot={{ r:4 }} />
                    <XAxis dataKey="timestamp" hide /><YAxis hide domain={['auto','auto']} />
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