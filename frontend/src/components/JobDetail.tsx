import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Terminal, Activity, Cpu, HardDrive, Zap } from 'lucide-react';
import { Job, JobLog, MetricData } from '../types';
import { Socket } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
  socket: Socket | null;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack, socket }) => {
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Socket connection and log fetching
  useEffect(() => {
    // Fetch past logs from API
    fetch(`http://localhost:5000/api/jobs/${job.id}/logs`)
      .then(res => res.json())
      .then(data => {
        console.log(data);
        
        // Type the data properly
        console.table(data)
        setLogs(data)
        setTerminalOutput(data.map((l: JobLog) => `[${l.level}] ${l.message}`));
      })
      .catch(error => {
        console.error('Error fetching logs:', error);
      });

    if (socket) {
      socket.emit('join_job', { job_id: job.id });

      const handleJobLog = (data: any) => {
        if (data.job_id === job.id) {
          setTerminalOutput(prev => [...prev, data.line]);
        }
      };

      const handleJobStatus = (data: any) => {
        if (data.job_id === job.id) {
          console.log('Job status updated:', data.status);
        }
      };

      socket.on('job_log', handleJobLog);
      socket.on('job_status', handleJobStatus);

      return () => {
        socket.emit('leave_job', { job_id: job.id });
        socket.off('job_log', handleJobLog);
        socket.off('job_status', handleJobStatus);
      };
    }
  }, [socket, job.id]);

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
          gpu: job.status === 'running' ? 40 + Math.random() * 40 : 0,
        });
      }
      
      setMetrics(mockData);
    };

    generateMockMetrics();
    const interval = setInterval(generateMockMetrics, 5000);
    
    return () => clearInterval(interval);
  }, [job.status]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 opacity-0 animate-fade-in">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center px-4 py-2 text-slate-400 hover:text-white transition-colors mr-6 hover:scale-105 transform"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">{job.name}</h1>
              <p className="text-slate-400">Job ID: {job.id}</p>
            </div>
          </div>
          
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            job.status === 'running' 
              ? 'bg-green-500/20 text-green-400' 
              : job.status === 'pending'
              ? 'bg-yellow-500/20 text-yellow-400'
              : job.status === 'completed'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terminal Section */}
          <div className="lg:col-span-2 opacity-0 animate-fade-in-delay-1">
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center px-6 py-4 bg-slate-900/50 border-b border-slate-700">
                <Terminal className="w-5 h-5 text-slate-400 mr-3" />
                <span className="text-white font-semibold">Live Output</span>
                <div className="ml-auto flex space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
              </div>
              
              <div 
                ref={terminalRef}
                className="h-80 p-4 bg-black font-mono text-sm overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800"
              >
                {terminalOutput.map((line, index) => (
                  <div
                    key={index}
                    className={`mb-1 opacity-0 animate-slide-in ${
                      line.includes('[ERROR]') 
                        ? 'text-red-400' 
                        : line.includes('[WARNING]')
                        ? 'text-yellow-400'
                        : line.includes('[INFO]')
                        ? 'text-blue-400'
                        : 'text-green-400'
                    }`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <span className="text-slate-500">[{formatTime(new Date().toISOString())}]</span> {line}
                  </div>
                ))}
                {job.status === 'running' && (
                  <div className="text-green-400 animate-pulse">
                    ▋
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Job Info */}
          <div className="space-y-6 opacity-0 animate-fade-in-delay-2">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Job Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-white font-mono">{job.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Main Entry:</span>
                  <span className="text-white font-mono">{job.main_entry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Requirements:</span>
                  <span className="text-white font-mono">{job.requirements_file}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created:</span>
                  <span className="text-white">{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Docker Image:</span>
                  <span className="text-white font-mono text-xs">{job.docker_image_tag}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Section */}
        <div className="mt-8 opacity-0 animate-fade-in-delay-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CPU Usage */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mr-3">
                  <Cpu className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">CPU Usage</h3>
                  <p className="text-slate-400 text-sm">
                    {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].cpu)}%` : '0%'}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={metrics.slice(-10)}>
                  <Area 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Memory Usage */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3">
                  <HardDrive className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Memory Usage</h3>
                  <p className="text-slate-400 text-sm">
                    {metrics.length > 0 ? `${Math.round(metrics[metrics.length - 1].memory)}%` : '0%'}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={metrics.slice(-10)}>
                  <Area 
                    type="monotone" 
                    dataKey="memory" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* GPU Usage */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">GPU Usage</h3>
                  <p className="text-slate-400 text-sm">
                    {metrics.length > 0 && metrics[metrics.length - 1].gpu 
                      ? `${Math.round(metrics[metrics.length - 1].gpu!)}%` 
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={metrics.slice(-10)}>
                  <Area 
                    type="monotone" 
                    dataKey="gpu" 
                    stroke="#A855F7" 
                    fill="#A855F7" 
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }

        .animate-fade-in-delay-1 {
          animation: fade-in 0.6s ease-out 0.1s forwards;
        }

        .animate-fade-in-delay-2 {
          animation: fade-in 0.6s ease-out 0.2s forwards;
        }

        .animate-fade-in-delay-3 {
          animation: fade-in 0.6s ease-out 0.3s forwards;
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default JobDetail;