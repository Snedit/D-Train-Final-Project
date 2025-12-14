import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Zap, Activity, Eye } from 'lucide-react';
import { Job } from '../types';

interface RunningJobsProps {
  jobs: Job[];
  onJobSelect: (job: Job) => void;
  onBack: () => void;
}

const RunningJobs: React.FC<RunningJobsProps> = ({ jobs, onJobSelect, onBack }) => {
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
            <Play className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/4 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <Activity className="w-8 h-8 text-slate-900" />
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
                Running Jobs
              </h1>
              <p className="text-sm text-slate-700 font-medium">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} currently executing
              </p>
            </div>

            {/* Running Jobs Grid */}
            {jobs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {jobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      whileHover={{ y: -3 }}
                      onClick={() => onJobSelect(job)}
                      className="rounded-[20px] border-[3px] border-slate-900 bg-white p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] cursor-pointer"
                    >
                      {/* Job Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ 
                              scale: [1, 1.2, 1],
                              opacity: [0.7, 1, 0.7]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-3 h-3 bg-[#22C55E] rounded-full border-[2px] border-slate-900"
                          />
                          <span className="px-2 py-1 rounded-full border-[2px] border-slate-900 bg-[#7CF2D0] text-[10px] font-bold text-slate-900">
                            RUNNING
                          </span>
                        </div>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="w-8 h-8 rounded-[10px] border-[2px] border-slate-900 bg-[#F5F3FF] flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4 text-slate-900" />
                        </motion.div>
                      </div>

                      {/* Job Info */}
                      <div className="mb-4">
                        <h3 className="text-base font-extrabold text-slate-900 mb-2">
                          {job.name}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium mb-1">ID: {job.id}</p>
                        <p className="text-xs text-slate-900 font-mono font-semibold">{job.main_entry}</p>
                      </div>

                      {/* Progress Indicators */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                          <span className="text-xs font-semibold text-slate-700">CPU Usage</span>
                          <div className="flex items-center gap-1">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                            >
                              <Zap className="w-3 h-3 text-yellow-500" />
                            </motion.div>
                            <span className="text-xs font-bold text-slate-900">
                              {Math.floor(Math.random() * 40 + 40)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                          <span className="text-xs font-semibold text-slate-700">Memory</span>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3 text-blue-500" />
                            <span className="text-xs font-bold text-slate-900">
                              {Math.floor(Math.random() * 30 + 50)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-[10px] border-[2px] border-slate-900 bg-[#FFFDF8]">
                          <span className="text-xs font-semibold text-slate-700">Runtime</span>
                          <span className="text-xs font-bold text-slate-900">
                            {Math.floor(Math.random() * 120 + 30)}m
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="w-full bg-[#E5E7EB] rounded-full h-3 border-[2px] border-slate-900 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.floor(Math.random() * 60 + 20)}%` }}
                            transition={{ duration: 1, delay: index * 0.2 }}
                            className="bg-gradient-to-r from-[#22C55E] to-[#10B981] h-full"
                          />
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-2">Training in progress...</p>
                      </div>
                    </motion.div>
                  ))}
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
                    className="w-20 h-20 rounded-[16px] bg-[#7CF2D0] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                  >
                    <Play className="w-10 h-10 text-slate-900" />
                  </motion.div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">No Running Jobs</h3>
                  <p className="text-sm text-slate-700 font-medium mb-6">All jobs are either pending or completed</p>
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

export default RunningJobs;
