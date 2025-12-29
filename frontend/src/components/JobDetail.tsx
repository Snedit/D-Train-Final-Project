import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Cpu, HardDrive, Zap, Clock, FileCode, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Job, MetricData } from '../types';
import { Socket } from 'socket.io-client';
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  socket: Socket | null;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack, socket }) => {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [jobStatus, setJobStatus] = useState(job.status);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  // ✅ Fetch initial logs from database
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoadingLogs(true);
        const token = localStorage.getItem('dtrain_token');
        
        const response = await fetch(
          `http://localhost:5000/api/jobs/${job._id}/logs`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('📋 Logs fetched from DB:', data.logs?.length || 0);
          
          // Set initial logs from database
          setTerminalOutput(data.logs || []);
          
          // Update status if changed
          if (data.status) {
            setJobStatus(data.status);
          }
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
        setTerminalOutput(['❌ Failed to load logs']);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [job._id]);

  // ✅ Socket connection and real-time log streaming
  useEffect(() => {
    if (!socket) return;

    // Join job room for real-time updates
    socket.emit('join_job', { jobId: job._id });
    console.log(`🚪 Joined room for job: ${job._id}`);

    // ✅ Listen for real-time logs
    const handleJobLog = (data: any) => {
      console.log('📡 Real-time log received:', data);
      
      if (data.jobId === job._id) {
        setTerminalOutput(prev => [...prev, data.line]);
      }
    };

    // ✅ Listen for job status changes
    const handleJobStatus = (data: any) => {
      console.log('📡 Job status updated:', data);
      
      if (data.jobId === job._id) {
        setJobStatus(data.status);
      }
    };

    // ✅ Listen for job completion
    const handleJobCompleted = (data: any) => {
      console.log('📡 Job completed:', data);
      
      if (data.jobId === job._id) {
        setJobStatus('completed');
        setTerminalOutput(prev => [
          ...prev,
          '\n✅ JOB COMPLETED SUCCESSFULLY!',
          `🔗 Output available at: ${data.modelUrl}`
        ]);
      }
    };

    // ✅ Listen for job failure
    const handleJobFailed = (data: any) => {
      console.log('📡 Job failed:', data);
      
      if (data.jobId === job._id) {
        setJobStatus('failed');
        setTerminalOutput(prev => [
          ...prev,
          `\n❌ JOB FAILED: ${data.errorMessage}`
        ]);
      }
    };

    socket.on('job:log', handleJobLog);
    socket.on('job_status', handleJobStatus);
    socket.on('job_completed', handleJobCompleted);
    socket.on('job_failed', handleJobFailed);

    return () => {
      socket.emit('leave_job', { jobId: job._id });
      socket.off('job:log', handleJobLog);
      socket.off('job_status', handleJobStatus);
      socket.off('job_completed', handleJobCompleted);
      socket.off('job_failed', handleJobFailed);
      console.log(`🚪 Left room for job: ${job._id}`);
    };
  }, [socket, job._id]);

  // Mock metrics data generation
  useEffect(() => {
    const generateMockMetrics = () => {
      const now = new Date();
      const mockData: MetricData[] = [];
      
      for (let i = 0; i < 20; i++) {
        const timestamp = new Date(now.getTime() - (19 - i) * 5000);
        mockData.push({
          timestamp: timestamp.toISOString(),
          cpu: 20 + Math.random() * 60,
          memory: 30 + Math.random() * 50,
          gpu: jobStatus === 'running' || jobStatus === 'assigned' ? 40 + Math.random() * 40 : 0,
        });
      }
      
      setMetrics(mockData);
    };

    generateMockMetrics();
    const interval = setInterval(generateMockMetrics, 5000);
    
    return () => clearInterval(interval);
  }, [jobStatus]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // const formatTime = (timestamp: string) => {
  //   return new Date(timestamp).toLocaleTimeString();
  // };

  const statusColors = {
    pending: 'bg-[#FFE66D] text-slate-900',
    assigned: 'bg-[#7BC8FF] text-slate-900',
    running: 'bg-[#7CF2D0] text-slate-900',
    completed: 'bg-[#4ADE80] text-slate-900',
    failed: 'bg-[#FEE2E2] text-slate-900',
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="relative">
          {/* Grid background card */}
          <div 
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '26px 26px',
            }}
          />

          {/* Memphis shapes */}
          <motion.div 
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ 
              rotate: [0, 15, -15, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 4, 
              ease: "easeInOut" 
            }}
          >
            <Activity className="w-8 h-8 text-slate-900" />
          </motion.div>

          <motion.div 
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0, -6, 0] }}
            transition={{ 
              repeat: Infinity, 
              duration: 5, 
              ease: "easeInOut" 
            }}
          />

          <motion.div 
            className="absolute top-1/3 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ 
              repeat: Infinity, 
              duration: 6, 
              ease: "easeInOut" 
            }}
          >
            <Terminal className="w-8 h-8 text-slate-900" />
          </motion.div>

          {/* Main content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Top nav */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img src="/logo.png" alt="DTrain Logo" className="w-8 h-8 object-contain" />
                </div>
                <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">
                  DTrain
                </span>
              </div>

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onBack}
                className="flex items-center px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
              >
                Back to Dashboard
              </motion.button>
            </nav>

            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                    {job.title}
                  </h1>
                  <p className="text-sm text-slate-700 font-medium mb-2">{job.description}</p>
                  <p className="text-xs text-slate-600 font-mono">Job ID: {job._id}</p>
                </div>
                
                <div className={`inline-flex items-center px-4 py-2 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${
                  statusColors[jobStatus as keyof typeof statusColors] || 'bg-slate-300 text-slate-900'
                }`}>
                  {(jobStatus === 'running' || jobStatus === 'assigned') && <Activity className="w-3 h-3 mr-1.5" />}
                  {jobStatus === 'pending' && <Clock className="w-3 h-3 mr-1.5" />}
                  {jobStatus === 'completed' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                  {jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Terminal Section */}
              <div className="lg:col-span-2">
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
                  <div className="flex items-center px-6 py-4 bg-[#F5F3FF] border-b-[3px] border-slate-900">
                    <div className="w-10 h-10 bg-slate-900 rounded-[12px] flex items-center justify-center mr-3">
                      <Terminal className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Live Output</h3>
                      <p className="text-xs text-slate-700">
                        {isLoadingLogs ? 'Loading logs...' : 'Real-time execution logs'}
                      </p>
                    </div>
                    <div className="ml-auto flex space-x-2">
                      <div className="w-3 h-3 bg-[#fb7185] rounded-full border border-slate-900"></div>
                      <div className="w-3 h-3 bg-[#facc15] rounded-full border border-slate-900"></div>
                      <div className="w-3 h-3 bg-[#22c55e] rounded-full border border-slate-900"></div>
                    </div>
                  </div>
                  
                  <div 
                    ref={terminalRef}
                    className="h-96 p-4 bg-slate-900 font-mono text-xs overflow-y-auto"
                  >
                    {isLoadingLogs && terminalOutput.length === 0 ? (
                      <div className="text-[#7CF2D0] animate-pulse">Loading logs...</div>
                    ) : terminalOutput.length === 0 ? (
                      <div className="text-slate-500">No logs yet. Waiting for job to start...</div>
                    ) : (
                      terminalOutput.map((line, index) => (
                        <div
                          key={index}
                          className={`mb-1 ${
                            line.includes('❌') || line.includes('FAILED') || line.includes('[ERROR]')
                              ? 'text-red-400' 
                              : line.includes('⚠️') || line.includes('[WARNING]')
                              ? 'text-yellow-400'
                              : line.includes('✅') || line.includes('SUCCESS')
                              ? 'text-green-400'
                              : line.includes('[INFO]')
                              ? 'text-blue-400'
                              : 'text-[#E0E7FF]'
                          }`}
                        >
                          {line}
                        </div>
                      ))
                    )}
                    {(jobStatus === 'running' || jobStatus === 'assigned') && (
                      <div className="text-[#7CF2D0] animate-pulse inline-block">
                        ▋
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Job Info */}
              <div className="space-y-6">
                <div className="rounded-[20px] border-[3px] border-slate-900 bg-white p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-[12px] bg-[#7BC8FF] border-[2px] border-slate-900 flex items-center justify-center">
                      <FileCode className="w-5 h-5 text-slate-900" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">Job Information</h3>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-slate-700 font-semibold">Status:</span>
                      <span className="font-mono font-bold text-slate-900">{jobStatus}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-slate-700 font-semibold">Main Entry:</span>
                      <span className="font-mono font-bold text-slate-900">{job.config?.entryFile}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-slate-700 font-semibold">Requirements:</span>
                      <span className="font-mono font-bold text-slate-900">requirements.txt</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200">
                      <span className="text-slate-700 font-semibold">Created:</span>
                      <span className="font-medium text-slate-900">{new Date(job.createdAt).toLocaleDateString()}</span>
                    </div>
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
              </div>
            </div>

            {/* Metrics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* CPU Usage */}
              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7BC8FF] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Cpu className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">CPU Usage</h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].cpu)}%` : '0%'}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={metrics.slice(-10)}>
                    <Area 
                      type="monotone" 
                      dataKey="cpu" 
                      stroke="#0f172a" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Memory Usage */}
              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <HardDrive className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Memory Usage</h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].memory)}%` : '0%'}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={metrics.slice(-10)}>
                    <Area 
                      type="monotone" 
                      dataKey="memory" 
                      stroke="#0f172a" 
                      fill="#10B981" 
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* GPU Usage */}
              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">GPU Usage</h3>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {metrics.length > 0 && metrics[metrics.length - 1].gpu 
                        ? `${Math.round(metrics[metrics.length - 1].gpu!)}%` 
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={metrics.slice(-10)}>
                    <Area 
                      type="monotone" 
                      dataKey="gpu" 
                      stroke="#0f172a" 
                      fill="#A855F7" 
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis hide />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-6px) rotate(-8deg); }
        }
        
        @keyframes wiggle {
          0%, 100% { transform: rotate(6deg); }
          50% { transform: rotate(2deg); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default JobDetail;