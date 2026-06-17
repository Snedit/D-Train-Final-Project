import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Socket } from 'socket.io-client';
import {
  Play, StopCircle, ArrowLeft, Terminal,
  Search, CheckCircle, Info, Download, Package, Rocket, FileText,
  Cloud, Link, Trash2, PartyPopper, XCircle, AlertTriangle,
  Smartphone, Bot, Clock, IndianRupee
} from 'lucide-react';
import type { Job } from '../types';
import { API_BASE } from "../config";

interface RunningJobsProps {
  jobId: string;
  workerId: string;
  onJobComplete?: (job: Job) => void;
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

const RunningJobs: React.FC<RunningJobsProps> = ({ jobId, workerId, onJobComplete, onBack, socket: _socket }) => {
  const [logs, setLogs]             = useState<string[]>(['> dtrain-worker ready\n> waiting for job...']);
  const [isRunning, setIsRunning]   = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [job, setJob]               = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Tier pricing — fetched from job on load, fixed for entire job
  const [tierPrice, setTierPrice] = useState<number | null>(null);
  const [workerPay, setWorkerPay] = useState<number | null>(null);

  const logsRef        = useRef<HTMLDivElement>(null);
  const logListenerRef = useRef<((data: string) => void) | null>(null);
  const startTimeRef   = useRef<Date | null>(null);
  const localTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    logsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Local elapsed ticker ──────────────────────────────────────────
  useEffect(() => {
    if (localTickerRef.current) clearInterval(localTickerRef.current);
    if (!isRunning) return;
    localTickerRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
    }, 1000);
    return () => { if (localTickerRef.current) clearInterval(localTickerRef.current); };
  }, [isRunning]);

  // ── Docker metrics via Electron IPC ──────────────────────────────
  useEffect(() => {
    const w = (window as any).worker;
    if (!w?.onMetrics) return;
    w.onMetrics(async (data: { cpu: number; memory: number; timestamp: string }) => {
      try {
        await fetch(`${API_BASE}/api/worker/metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId, deviceId: workerId,
            cpu: data.cpu, ram: data.memory, gpu: 0,
            durationMs: startTimeRef.current ? Date.now() - startTimeRef.current.getTime() : 0,
            timestamp: data.timestamp,
          }),
        });
      } catch (_) {}
    });
    return () => { (window as any).worker?.offMetrics?.(); };
  }, [jobId, workerId]);

  // ── Fetch job details (get tier pricing) ─────────────────────────
  useEffect(() => {
    scrollToBottom();
    fetch(`${API_BASE}/api/worker/job/${jobId}/details?deviceId=${workerId}`, {
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const jobData = data.job || data;
        setJob(jobData);
        setLogs(prev => [...prev, `\n[INFO] Job: ${jobData.title || 'Untitled'}\n`]);

        // Read tier pricing from job
        const tp = jobData.pricing?.tierPrice;
        const wp = jobData.pricing?.workerPay ?? (tp ? parseFloat((tp * 0.8).toFixed(2)) : null);
        if (tp) {
          setTierPrice(tp);
          setWorkerPay(wp);
          setLogs(prev => [...prev, `[INFO] Tier: ₹${tp} — You will earn ₹${wp} on completion\n`]);
        }
      })
      .catch(err => {
        setLogs(prev => [...prev, `\n[ERROR] Failed to fetch job: ${err.message}`]);
      });
  }, [jobId, workerId, scrollToBottom]);

  useEffect(() => {
    return () => { if (logListenerRef.current && (window as any).worker) {} };
  }, []);

  const handleStart = async () => {
    if (isRunning || isCompleted) return;
    if (!(window as any).worker) {
      setLogs(prev => [...prev, '\n[ERROR] Worker runtime not available (run in Electron)']);
      return;
    }

    startTimeRef.current = new Date();
    setIsRunning(true);
    setElapsedTime(0);
    setLogs(prev => [...prev, `\n> Starting job ${jobId.slice(-8)}...\n`]);

    const logListener = (data: string) => {
      setLogs(prev => [...prev, data.replace(/\n$/, '')]);
      scrollToBottom();
    };
    logListenerRef.current = logListener;
    if ((window as any).worker.onLog) (window as any).worker.onLog(logListener);

    try {
      const result = await (window as any).worker.runTestJob(jobId, workerId);

      setIsCompleted(true);
      setIsRunning(false);
      if (localTickerRef.current) { clearInterval(localTickerRef.current); localTickerRef.current = null; }

      if (result.success && onJobComplete && job) {
        onJobComplete({ ...job, status: 'completed' });
      } else {
        setLogs(prev => [...prev, `\n[WARN] Job completed but result.success=false: ${JSON.stringify(result)}`]);
      }
    } catch (error: any) {
      setLogs(prev => [...prev, `\n[ERROR] Failed: ${error.message || error}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setLogs(prev => [...prev, '\n> [WARN] Press Ctrl+C in Docker terminal or restart app to stop']);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="relative">
          <div className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{ backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)`, backgroundSize: '26px 26px' }} />

          <motion.div className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ rotate: [0,15,-15,0], scale: [1,1.1,1] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
            <Play className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0,-6,0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} />

          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">

            {/* Nav */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img src="logo.png" alt="DTrain Logo" className="w-8 h-8 object-contain" />
                </div>
                <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">DTrain</span>
              </div>
              <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={onBack}
                className="flex items-center gap-2 px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:bg-blue-500 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </motion.button>
            </nav>

            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">Running Job</h1>
                <p className="text-sm text-slate-700 font-medium font-mono">
                  worker@{workerId.slice(-8)} · job-{jobId.slice(-8)}
                </p>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {/* Worker earnings — replaces "Current Cost" */}
                <div className="px-5 py-3 rounded-[14px] bg-[#7CF2D0] border-[3px] border-slate-900 flex items-center gap-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <div className="w-10 h-10 rounded-full bg-white border-[2px] border-slate-900 flex items-center justify-center">
                    <IndianRupee className="w-5 h-5 text-green-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Your Earnings</p>
                    <p className="text-xl font-black text-slate-900">
                      {workerPay != null ? `₹${workerPay}` : '—'}
                    </p>
                    {tierPrice && <p className="text-[10px] text-slate-600 font-medium">for this job</p>}
                  </div>
                </div>

                {/* Elapsed time */}
                <div className="px-5 py-3 rounded-[14px] bg-[#DCFCE7] border-[3px] border-slate-900 flex items-center gap-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <div className="w-10 h-10 rounded-full bg-white border-[2px] border-slate-900 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Duration</p>
                    <p className="text-xl font-black text-slate-900">{formatDuration(elapsedTime)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier info banner */}
            {tierPrice && !isCompleted && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-3 px-5 py-3 rounded-[16px] border-[3px] border-slate-900 bg-[#FFE66D] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <IndianRupee className="w-5 h-5 text-slate-900 flex-shrink-0" />
                <p className="text-sm font-semibold text-slate-900">
                  This job pays <span className="font-extrabold">₹{workerPay}</span> on successful completion
                </p>
              </motion.div>
            )}
            {isCompleted && workerPay && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center gap-3 px-5 py-3 rounded-[16px] border-[3px] border-slate-900 bg-[#4ADE80] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <CheckCircle className="w-5 h-5 text-slate-900 flex-shrink-0" />
                <p className="text-sm font-extrabold text-slate-900">₹{workerPay} credited to your wallet!</p>
              </motion.div>
            )}

            {/* Terminal */}
            <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden mb-6">
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
                    <p className="text-xs text-slate-700">Real-time execution logs</p>
                  </div>
                </div>
                <div className={`inline-flex items-center px-4 py-2 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${
                  isCompleted ? 'bg-[#4ADE80] text-slate-900' : isRunning ? 'bg-[#7CF2D0] text-slate-900' : 'bg-[#FFE66D] text-slate-900'
                }`}>
                  {isCompleted ? '✓ COMPLETED' : isRunning ? '▶ RUNNING' : '○ READY'}
                </div>
              </div>
              <div className="h-96 p-4 bg-slate-900 font-mono text-xs overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="text-[#7CF2D0] whitespace-pre-wrap mb-1 flex items-start">
                    {parseLogLine(log)}
                  </div>
                ))}
                <div ref={logsRef} />
                {isRunning && <div className="text-[#7CF2D0] animate-pulse inline-block">▋</div>}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-end gap-3">
              {!isRunning && !isCompleted && (
                <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={handleStart}
                  className="flex items-center gap-2 px-8 py-4 rounded-[16px] border-[3px] border-slate-900 bg-[#4ADE80] text-slate-900 font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] transition-all">
                  <Play className="w-5 h-5" /> START JOB
                </motion.button>
              )}
              {isRunning && (
                <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={handleStop}
                  className="flex items-center gap-2 px-8 py-4 rounded-[16px] border-[3px] border-slate-900 bg-[#fb7185] text-white font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] transition-all">
                  <StopCircle className="w-5 h-5" /> STOP
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunningJobs;