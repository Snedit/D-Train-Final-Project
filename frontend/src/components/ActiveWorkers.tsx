import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Server, Cpu, HardDrive, Wifi, Clock, Activity} from 'lucide-react';
import { Worker, Job } from '../types';

interface ActiveWorkersProps {
  workers: Worker[];
  jobs: Job[];
  onBack: () => void;
}

const ActiveWorkers: React.FC<ActiveWorkersProps> = ({ workers, jobs, onBack }) => {
  const getWorkerStatus = (worker: Worker) => {
    const runningJob = jobs.find(job => job.accepted_by === worker.id && job.status === 'running');
    if (runningJob) return { status: 'busy', job: runningJob };
    return { status: worker.currentStatus, job: null };

  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const lastSeen = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

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
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFB4D3] flex items-center justify-center"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Users className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/4 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#7BC8FF] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <Server className="w-8 h-8 text-slate-900" />
          </motion.div>

          {/* Main content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Top nav */}
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
            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                Active Workers
              </h1>
              <p className="text-sm text-slate-700 font-medium">
                {workers.length} {workers.length === 1 ? 'worker' : 'workers'} in the network
              </p>
            </div>

            {/* Network Stats - NO ANIMATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {workers.filter(w => getWorkerStatus(w).status === 'busy').length}
                    </p>
                    <p className="text-xs font-semibold text-slate-900">Busy Workers</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#7BC8FF] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Server className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">
                      {workers.filter(w => getWorkerStatus(w).status === 'idle').length}
                    </p>
                    <p className="text-xs font-semibold text-slate-900">Idle Workers</p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -2 }}
                className="rounded-[18px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[5px_5px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[7px_7px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-slate-900">{workers.length}</p>
                    <p className="text-xs font-semibold text-slate-900">Total Online</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Workers Grid */}
            {workers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {workers.map((worker, index) => {
                    const workerStatus = getWorkerStatus(worker);
                    const isBusy = workerStatus.status === 'busy';

                    return (
                      <motion.div
                        key={worker.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        whileHover={{ y: -3 }}
                        className="rounded-[20px] border-[3px] border-slate-900 bg-white p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
                      >
                        {/* Worker Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={isBusy ? { 
                                scale: [1, 1.2, 1],
                                opacity: [0.7, 1, 0.7]
                              } : {}}
                              transition={{ duration: 2, repeat: Infinity }}
                              className={`w-3 h-3 rounded-full border-[2px] border-slate-900 ${
                                isBusy ? 'bg-[#22C55E]' : 'bg-[#7BC8FF]'
                              }`}
                            />
                            <span className={`px-2 py-1 rounded-full border-[2px] border-slate-900 text-[10px] font-bold ${
                              isBusy ? 'bg-[#7CF2D0] text-slate-900' : 'bg-[#E4ECFF] text-slate-900'
                            }`}>
                              {isBusy ? 'BUSY' : 'IDLE'}
                            </span>
                          </div>
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className={`w-8 h-8 rounded-[10px] border-[2px] border-slate-900 flex items-center justify-center ${
                              isBusy ? 'bg-[#7CF2D0]' : 'bg-[#FFB4D3]'
                            }`}
                          >
                            <Server className="w-4 h-4 text-slate-900" />
                          </motion.div>
                        </div>

                        {/* Worker Info */}
                        <div className="mb-4">
                          <h3 className="text-base font-extrabold text-slate-900 mb-2">
                            {worker.name}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium mb-2">ID: {worker._id}</p>
                          {workerStatus.job && (
                            <p className="text-xs text-slate-900 font-semibold">
                              Running: <span className="font-mono">{workerStatus.job.name}</span>
                            </p>
                          )}
                        </div>

                        {/* System Metrics */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                            <div className="flex items-center gap-1">
                              <motion.div
                                animate={isBusy ? { rotate: 360 } : {}}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              >
                                <Cpu className="w-3 h-3 text-blue-500" />
                              </motion.div>
                              <span className="text-xs font-semibold text-slate-700">CPU</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900">
                              {isBusy ? Math.floor(Math.random() * 40 + 50) : Math.floor(Math.random() * 20 + 5)}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                            <div className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3 text-green-500" />
                              <span className="text-xs font-semibold text-slate-700">Memory</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900">
                              {isBusy ? Math.floor(Math.random() * 30 + 40) : Math.floor(Math.random() * 15 + 10)}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-purple-500" />
                              <span className="text-xs font-semibold text-slate-700">Last Seen</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900">
                              {getTimeAgo(worker.last_seen)}
                            </span>
                          </div>
                        </div>

                        {/* Activity Indicator */}
                        <div className="border-t-[2px] border-slate-900 pt-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-700">Network Status</span>
                            <div className="flex items-center gap-1">
                              <motion.div
                                animate={{ 
                                  scale: [1, 1.2, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 bg-[#22C55E] rounded-full border border-slate-900"
                              />
                              <span className="text-xs font-bold text-slate-900">{worker.currentStatus}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              /* Empty State */
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center py-16"
              >
                <div className="rounded-[22px] border-[3px] border-slate-900 bg-white p-12 shadow-[8px_8px_0_0_rgba(15,23,42,1)] max-w-md mx-auto">
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-20 h-20 rounded-[16px] bg-[#FFB4D3] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                  >
                    <Users className="w-10 h-10 text-slate-900" />
                  </motion.div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">No Active Workers</h3>
                  <p className="text-sm text-slate-700 font-medium mb-6">No workers are currently connected to the network</p>
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                    onClick={onBack}
                    className="px-6 py-3 rounded-[14px] border-[3px] border-slate-900 bg-blue-400 text-white font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] hover:bg-blue-500"
                  >
                    Back to Dashboard
                  </motion.button>
                </div>
              </motion.div>
            )}
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

export default ActiveWorkers;
