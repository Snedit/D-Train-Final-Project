import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, StopCircle, ArrowLeft } from 'lucide-react';
import type { Job } from '../types';

interface RunningJobsProps {
  jobId: string;
  workerId: string;
  onJobComplete?: (job: Job) => void;
  onBack: () => void;
}

const RunningJobs: React.FC<RunningJobsProps> = ({ jobId, workerId, onJobComplete, onBack }) => {
  const [logs, setLogs] = useState<string[]>(['> dtrain-worker ready\n> waiting for job...']);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [job, setJob] = useState<any>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const logListenerRef = useRef<((data: string) => void) | null>(null);

  const scrollToBottom = useCallback(() => {
    logsRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ✅ FIXED: Fetch job details using worker endpoint (no auth token)
  useEffect(() => {
    scrollToBottom();
    console.log('📡 Fetching job details for:', jobId);
    
    fetch(`http://localhost:5000/api/worker/job/${jobId}/details?deviceId=${workerId}`, {
      headers: { 'Content-Type': 'application/json' }
      // NO Authorization header - worker uses deviceId
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('✅ Job fetched:', data);
        const jobData = data.job || data; // Handle both response formats
        setJob(jobData);
        setLogs(prev => [...prev, `\n📋 Job: ${jobData.title || 'Untitled'}\n`]);
      })
      .catch(err => {
        console.error('❌ Job fetch failed:', err);
        setLogs(prev => [...prev, `\n❌ Failed to fetch job: ${err.message}`]);
      });
  }, [jobId, workerId, scrollToBottom]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (logListenerRef.current && window.worker) {
        console.log('🧹 Listener cleaned up');
      }
    };
  }, []);

  const handleStart = async () => {
    if (isRunning || isCompleted) return;
    
    console.log('🚀 START JOB CLICKED - worker exists?', !!window.worker);
    
    if (!window.worker) {
      setLogs(prev => [...prev, '\n❌ Worker runtime not available (run in Electron)']);
      console.error('❌ window.worker not found - must run in Electron');
      return;
    }
    
    setIsRunning(true);
    setLogs(prev => [...prev, `\n> Starting job ${jobId.slice(-8)}...\n`]);
    
    const logListener = (data: string) => {
      console.log('📨 Log received:', data.trim());
      setLogs(prev => [...prev, data.replace(/\n$/, '')]);
      scrollToBottom();
    };
    
    logListenerRef.current = logListener;
    
    if (window.worker.onLog) {
      console.log('🔗 Setting up log listener');
      window.worker.onLog(logListener);
    }
    
    try {
      // ✅ CRITICAL: Pass workerId (deviceId) to Electron, not auth token
      console.log('📤 Calling Electron: runTestJob(', jobId, ', workerId:', workerId, ')');
      const result = await window.worker.runTestJob(jobId, workerId);
      console.log('📥 Electron result:', result);
      
      setIsCompleted(true);
      
      if (result.success && onJobComplete && job) {
        console.log('✅ Calling onJobComplete');
        onJobComplete({ ...job, status: 'completed' });
      } else {
        setLogs(prev => [...prev, `\n⚠️ Job completed but result.success=false:`, JSON.stringify(result)]);
      }
    } catch (error: any) {
      console.error('❌ runTestJob FAILED:', error);
      setLogs(prev => [...prev, `\n❌ Failed: ${error.message || error}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    setLogs(prev => [...prev, '\n> ⚠️  Press Ctrl+C in Docker terminal or restart app to stop']);
  };

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Terminal Header */}
      <div className="p-4 border-b border-green-800/50 flex items-center gap-3">
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
        </div>
        <span>dtrain-worker@{workerId.slice(-8)}</span>
        <span className="text-green-300 ml-auto">
          job-{jobId.slice(-8)}
        </span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="ml-4 text-green-400 hover:text-green-300 flex items-center gap-1 text-sm"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </motion.button>
      </div>

      {/* Terminal Body */}
      <div className="h-[calc(100vh-100px)] flex flex-col">
        {/* Logs */}
        <div className="flex-1 p-4 overflow-y-auto bg-black/50">
          <div className="space-y-1 text-sm">
            {logs.map((log, i) => (
              <div key={i} className="whitespace-pre-wrap">{log}</div>
            ))}
            <div ref={logsRef} />
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-t border-green-800/50 bg-black/70">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
              isRunning ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
              'bg-gray-500/20 text-gray-400 border border-gray-500/50'
            }`}>
              {isCompleted ? '✓ COMPLETED' : isRunning ? '▶ RUNNING' : '○ READY'}
            </span>
            
            {!isRunning && !isCompleted && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg shadow-lg border-2 border-green-400"
              >
                <Play className="w-5 h-5" />
                START JOB
              </motion.button>
            )}
            
            {isRunning && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg border-2 border-red-400"
                onClick={handleStop}
              >
                <StopCircle className="w-5 h-5" />
                STOP
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunningJobs;