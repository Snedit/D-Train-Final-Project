import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, CheckCircle, XCircle, Activity, ArrowLeft } from 'lucide-react';
import type { Job } from '../types';

interface RunningJobsProps {
  jobId: string;
  workerId: string;
  onJobComplete?: (job: Job) => void;
  onBack: () => void;
}

const RunningJobs: React.FC<RunningJobsProps> = ({ 
  jobId, 
  workerId, 
  onJobComplete, 
  onBack 
}) => {
  const [job, setJob] = useState<Job | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetails();
    
    // Simulate job execution
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          handleJobCompletion();
          return 100;
        }
        return prev + 5;
      });
      
      // Simulate logs
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Processing... ${progress}%`]);
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const token = localStorage.getItem('dtrain_worker_token');
      const response = await fetch(`http://localhost:5000/api/jobs/${jobId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setJob(data);
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJobCompletion = async () => {
    try {
      // Mark job as completed
      await fetch('http://localhost:5000/api/worker/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          modelUrl: 'https://example.com/model.pkl',
          logsUrl: 'https://example.com/logs.txt',
        }),
      });

      if (job && onJobComplete) {
        onJobComplete({ ...job, status: 'completed' });
      }
    } catch (error) {
      console.error('Failed to complete job:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-slate-900 animate-spin mx-auto mb-4" />
          <p className="text-lg font-extrabold text-slate-900">Loading job...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.button
            whileHover={{ x: -4 }}
            onClick={onBack}
            className="flex items-center gap-2 text-slate-900 font-bold mb-4 hover:text-blue-600"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </motion.button>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
            Running Job
          </h1>
          <p className="text-sm text-slate-700 font-medium">
            Job ID: <span className="font-mono font-bold">{jobId}</span>
          </p>
        </div>

        {/* Progress Card */}
        <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-[#7CF2D0]" />
              Training Progress
            </h2>
            <span className="text-2xl font-extrabold text-slate-900">{progress}%</span>
          </div>
          
          <div className="w-full h-8 rounded-full border-[3px] border-slate-900 bg-[#FFFDF8] overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-[#7CF2D0] to-[#4ADE80] border-r-[3px] border-slate-900"
            />
          </div>

          {progress === 100 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-[#4ADE80] font-bold"
            >
              <CheckCircle className="w-5 h-5" />
              Job completed successfully!
            </motion.div>
          )}
        </div>

        {/* Logs */}
        <div className="rounded-[22px] border-[3px] border-slate-900 bg-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
          <div className="p-4 border-b-[3px] border-slate-700 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-slate-900" />
              <div className="w-3 h-3 rounded-full bg-yellow-500 border border-slate-900" />
              <div className="w-3 h-3 rounded-full bg-green-500 border border-slate-900" />
            </div>
            <span className="text-sm font-bold text-white ml-2">Terminal Output</span>
          </div>
          <div className="p-4 h-64 overflow-y-auto font-mono text-sm text-[#7CF2D0] space-y-1">
            {logs.length === 0 ? (
              <p className="text-slate-500">Waiting for logs...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="hover:bg-slate-800 px-2 py-1 rounded">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RunningJobs;
