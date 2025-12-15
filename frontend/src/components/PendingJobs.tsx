import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, FileText, Settings, AlertCircle, ArrowRight } from 'lucide-react';
import { Job } from '../types';

interface PendingJobsProps {
  jobs: Job[];
  onJobSelect: (job: Job) => void;
  onBack: () => void;
}

const PendingJobs: React.FC<PendingJobsProps> = ({ jobs, onJobSelect, onBack }) => {
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    
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
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFE66D] flex items-center justify-center"
            animate={{ 
              rotate: [0, 15, -15, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Clock className="w-8 h-8 text-slate-900" />
          </motion.div>
          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7BC8FF]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          >
            <FileText className="w-8 h-8 text-slate-900" />
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
                Pending Jobs
              </h1>
              <p className="text-sm text-slate-700 font-medium">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} waiting for workers
              </p>
            </div>

            {/* Queue Status Banner */}
            {jobs.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="rounded-[20px] border-[3px] border-slate-900 bg-gradient-to-r from-[#FFE66D] to-[#FFD447] p-5 mb-8 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-12 h-12 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0 shadow-[3px_3px_0_0_rgba(15,23,42,1)]"
                  >
                    <AlertCircle className="w-6 h-6 text-slate-900" />
                  </motion.div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-1">Job Queue Status</h3>
                    <p className="text-sm text-slate-900 font-semibold">
                      {jobs.length} jobs in queue • Waiting for available workers
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Pending Jobs List */}
            {jobs.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence>
                  {jobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                      whileHover={{ x: 3 }}
                      className="rounded-[20px] border-[3px] border-slate-900 bg-white p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] cursor-pointer group"
                      onClick={() => onJobSelect(job)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Queue Position */}
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="w-14 h-14 rounded-[14px] bg-[#FFE66D] border-[3px] border-slate-900 flex items-center justify-center flex-shrink-0 shadow-[3px_3px_0_0_rgba(15,23,42,1)] group-hover:bg-[#FFD447]"
                          >
                            <span className="text-slate-900 font-extrabold text-lg">#{index + 1}</span>
                          </motion.div>

                          {/* Job Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-base font-extrabold text-slate-900 truncate">
                                {job.name}
                              </h3>
                              <motion.div
                                animate={{ 
                                  scale: [1, 1.3, 1],
                                  opacity: [0.5, 1, 0.5]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2 h-2 bg-yellow-500 rounded-full border border-slate-900 flex-shrink-0"
                              />
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <span className="font-mono font-semibold">{job.config?.entryFile}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="font-medium">{getTimeAgo(job.createdAt)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Settings className="w-3 h-3" />
                                <span className="font-medium">ID: {job._id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FEF3C7] text-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                              Waiting
                            </div>
                            <motion.div
                              animate={{ x: [0, 4, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="text-slate-900 group-hover:text-blue-500"
                            >
                              <ArrowRight className="w-5 h-5" />
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="w-full bg-[#E5E7EB] rounded-full h-2 border-[2px] border-slate-900 overflow-hidden">
                          <motion.div
                            animate={{ 
                              width: ['0%', '40%', '0%'],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="bg-gradient-to-r from-[#FFD447] to-[#FBBF24] h-full"
                          />
                        </div>
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
                    className="w-20 h-20 rounded-[16px] bg-[#FFE66D] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                  >
                    <Clock className="w-10 h-10 text-slate-900" />
                  </motion.div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">No Pending Jobs</h3>
                  <p className="text-sm text-slate-700 font-medium mb-6">All jobs have been picked up by workers</p>
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

export default PendingJobs;
