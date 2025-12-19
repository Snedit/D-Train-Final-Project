import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, Download, FileText, Package } from 'lucide-react';
import type { Job } from '../types';

interface JobDetailProps {
  job: Job;
  onBack: () => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, onBack }) => {
  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-4xl mx-auto">
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
            Job Completed
          </h1>
          <p className="text-sm text-slate-700 font-medium">
            Job ID: <span className="font-mono font-bold">{job._id}</span>
          </p>
        </div>

        {/* Success Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-slate-900" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
                Training Complete!
              </h2>
              <p className="text-sm text-slate-700 font-medium">
                Your model has been successfully trained
              </p>
            </div>
          </div>

          {/* Job Info */}
          <div className="space-y-4">
            <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#F0F9FF] p-4">
              <p className="text-xs font-semibold text-slate-600 mb-1">Title</p>
              <p className="text-lg font-bold text-slate-900">{job.title}</p>
            </div>

            <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FEF3C7] p-4">
              <p className="text-xs font-semibold text-slate-600 mb-1">Description</p>
              <p className="text-sm font-medium text-slate-900">{job.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#DCFCE7] p-4">
                <p className="text-xs font-semibold text-slate-600 mb-1">Status</p>
                <p className="text-sm font-bold text-slate-900 capitalize">{job.status}</p>
              </div>

              <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FCE7F3] p-4">
                <p className="text-xs font-semibold text-slate-600 mb-1">Entry File</p>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {job.config.entryFile}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Download Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Model Download */}
          {job.modelUrl && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[18px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-[10px] border-[2px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Trained Model</h3>
                  <p className="text-xs text-slate-600 font-medium">Download your model</p>
                </div>
              </div>
              <a
                href={job.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
              >
                <Download className="w-4 h-4" />
                Download Model
              </a>
            </motion.div>
          )}

          {/* Logs Download */}
          {job.logsUrl && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-[18px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-[10px] border-[2px] border-slate-900 bg-[#FFD447] flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Training Logs</h3>
                  <p className="text-xs text-slate-600 font-medium">View complete logs</p>
                </div>
              </div>
              <a
                href={job.logsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 text-sm font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
              >
                <Download className="w-4 h-4" />
                Download Logs
              </a>
            </motion.div>
          )}
        </div>

        {/* Recent Logs Preview */}
        {job.logs && job.logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 rounded-[22px] border-[3px] border-slate-900 bg-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden"
          >
            <div className="p-4 border-b-[3px] border-slate-700 flex items-center gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-slate-900" />
                <div className="w-3 h-3 rounded-full bg-yellow-500 border border-slate-900" />
                <div className="w-3 h-3 rounded-full bg-green-500 border border-slate-900" />
              </div>
              <span className="text-sm font-bold text-white ml-2">Last 10 Logs</span>
            </div>
            <div className="p-4 h-64 overflow-y-auto font-mono text-sm text-[#7CF2D0] space-y-1">
              {job.logs.slice(-10).map((log, index) => (
                <div key={index} className="hover:bg-slate-800 px-2 py-1 rounded">
                  {typeof log === 'string' ? log : log.message}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
