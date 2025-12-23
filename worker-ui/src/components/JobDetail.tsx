import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  FileText,
  Package,
  PlayCircle,
  Clock,
  Archive,
  CheckCircle2,
  Server,
  AlertCircle,
} from "lucide-react";

interface Job {
  _id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  zipFileUrl?: string;
  modelUrl?: string;
  logsUrl?: string;
  logs?: any[];
  config?: {
    entryFile?: string;
  };
}

interface JobDetailProps {
  job?: Job;
  jobId?: string;
  workerId?: string;
  onBack: () => void;
  onAcceptJob?: (jobId: string) => void;
}

interface JobDetailsData {
  job: Job;
  zipMetadata: {
    name: string;
    size: number;
    createdAt: string;
    lastModified: string | null;
  } | null;
  zipFilesList: {
    name: string;
    type: string;
    required: boolean;
    size?: number;
  }[];
  filesExtractedFromZip?: boolean;
}

const JobDetail: React.FC<JobDetailProps> = ({
  job: completedJob,
  jobId,
  workerId,
  onBack,
  onAcceptJob,
}) => {
  const [jobDetails, setJobDetails] = useState<JobDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCompletedView = !!completedJob;
  const isPendingView = !!jobId && !!workerId;

  useEffect(() => {
    if (isPendingView && jobId) {
      fetchJobDetails(jobId);
    } else if (completedJob) {
      setJobDetails({
        job: completedJob,
        zipMetadata: null,
        zipFilesList: [],
        filesExtractedFromZip: false,
      });
    }
  }, [isPendingView, jobId, completedJob]);

  const fetchJobDetails = async (id: string) => {
    setLoading(true);
    try {
      // ✅ FIXED: Use worker endpoint with deviceId query param (no auth token)
      const response = await fetch(
        `http://localhost:5000/api/worker/job/${id}/details?deviceId=${workerId}`,
        {
          headers: {
            'Content-Type': 'application/json'
            // NO Authorization header - worker uses deviceId
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || "Failed to fetch job details");
      }

      const data = await response.json();
      setJobDetails(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load job details");
      console.error("Failed to fetch job details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!jobDetails || !workerId || !onAcceptJob) return;
    
    setAccepting(true);
    try {
      // ✅ FIXED: Use worker endpoint (no auth token needed)
      const response = await fetch(`http://localhost:5000/api/worker/accept-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId: jobDetails.job._id, 
          deviceId: workerId 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept job");
      }
      
      // Navigate to RunningJobs IMMEDIATELY
      onAcceptJob(jobDetails.job._id);
      
    } catch (err: any) {
      alert(err.message || "Failed to accept job");
    } finally {
      setAccepting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
            />
          </div>
          <p className="text-lg font-extrabold text-slate-900">
            Loading job details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !jobDetails) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-[16px] bg-[#FEE2E2] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <AlertCircle className="w-10 h-10 text-slate-900" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
            {error || "Job not found"}
          </h2>
          <p className="text-sm text-slate-700 font-medium mb-6">
            We couldn't load the job details. Please try again.
          </p>
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            onClick={onBack}
            className="px-6 py-3 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
          >
            Back to Dashboard
          </motion.button>
        </div>
      </div>
    );
  }

  const currentJob = jobDetails.job;

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
              backgroundSize: "26px 26px",
            }}
          />

          {/* Memphis shapes */}
          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Server className="w-8 h-8 text-slate-900" />
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#FFD447]"
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />

          {/* Main content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Top nav */}
            <nav className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <img
                    src="logo.png"
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
                className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </motion.button>
            </nav>

            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#E4ECFF] text-[11px] font-semibold text-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)] mb-3">
                {isCompletedView ? "Completed Job" : "Pending Job"}
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
                {isCompletedView ? "Training Complete!" : "Job Details"}
              </h1>
              <p className="text-sm text-slate-700 font-medium">
                Job ID{" "}
                <span className="font-mono font-bold">{currentJob._id}</span>
              </p>
            </div>

            {/* Success Banner for completed jobs */}
            {isCompletedView && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[22px] border-[3px] border-slate-900 bg-[#7CF2D0] p-6 mb-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-[16px] border-[3px] border-slate-900 bg-white flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                    <CheckCircle className="w-8 h-8 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
                      Your Model is Ready!
                    </h2>
                    <p className="text-sm text-slate-900 font-medium">
                      Training completed successfully. Download your model and logs below.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Job Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-6"
            >
              <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Job Information
              </h2>

              <div className="space-y-4">
                <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#F0F9FF] p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-1">
                    Title
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {currentJob.title}
                  </p>
                </div>

                <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FEF3C7] p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-1">
                    Description
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {currentJob.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#DCFCE7] p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      Status
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <p className="text-sm font-bold text-slate-900 capitalize">
                        {currentJob.status}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#E4ECFF] p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      Entry File
                    </p>
                    <p className="text-sm font-bold text-slate-900 font-mono">
                      {currentJob.config?.entryFile || "N/A"}
                    </p>
                  </div>
                </div>

                {isPendingView && (
                  <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FCE7F3] p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      Created At
                    </p>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-700" />
                      <p className="text-sm font-bold text-slate-900">
                        {new Date(currentJob.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ZIP File Details for pending jobs */}
            {isPendingView && currentJob.zipFileUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 mb-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[12px] border-[2px] border-slate-900 bg-[#FFD447] flex items-center justify-center shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                      <Archive className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Training Package
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        {jobDetails.zipMetadata
                          ? `${formatFileSize(jobDetails.zipMetadata.size)} • ${
                              jobDetails.zipMetadata.name
                            }`
                          : "ZIP file contents"}
                      </p>
                    </div>
                  </div>

                  {jobDetails.filesExtractedFromZip && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DCFCE7] border-[2px] border-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-slate-900" />
                      <span className="text-xs font-bold text-slate-900">
                        Verified
                      </span>
                    </div>
                  )}
                </div>

                {jobDetails.zipFilesList.length > 0 && (
                  <div className="rounded-[14px] border-[2px] border-slate-900 bg-[#FFFDF8] p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-3">
                      {jobDetails.filesExtractedFromZip
                        ? `Files in package (${jobDetails.zipFilesList.length} items)`
                        : "Expected files in package"}
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {jobDetails.zipFilesList.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 py-2 px-3 hover:bg-[#F0F9FF] rounded-[10px] transition-colors border-[2px] border-transparent hover:border-slate-900"
                        >
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              file.required ? "bg-[#4ADE80]" : "bg-slate-400"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 font-mono truncate">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-600">
                                {file.type}
                              </p>
                              {file.size && (
                                <>
                                  <span className="text-xs text-slate-400">
                                    •
                                  </span>
                                  <p className="text-xs text-slate-500">
                                    {formatFileSize(file.size)}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          {file.required && (
                            <span className="text-xs font-semibold text-slate-900 bg-[#DCFCE7] px-2 py-1 rounded-full border-[2px] border-slate-900 flex-shrink-0">
                              Required
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Accept Job Button for pending jobs */}
            {isPendingView && currentJob.status === "pending" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-[22px] border-[3px] border-slate-900 bg-[#7CF2D0] shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 text-center mb-6"
              >
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                  Ready to start training?
                </h3>
                <p className="text-sm text-slate-900 font-medium mb-4">
                  Accept this job to begin processing on your machine.
                </p>
                <motion.button
                  whileHover={!accepting ? { y: -2 } : {}}
                  whileTap={!accepting ? { y: 0 } : {}}
                  onClick={handleAccept}
                  disabled={accepting}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-[14px] border-[3px] border-slate-900 text-lg font-bold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all ${
                    accepting
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-blue-400 text-white hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-blue-500"
                  }`}
                >
                  {accepting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full"
                      />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5" />
                      Accept Job
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* Download Section for completed jobs */}
            {isCompletedView && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Model Download */}
                  {currentJob.modelUrl && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-[18px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] p-6 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-[12px] border-[2px] border-slate-900 bg-[#7CF2D0] flex items-center justify-center shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                          <Package className="w-6 h-6 text-slate-900" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-900">
                            Trained Model
                          </h3>
                          <p className="text-xs text-slate-600 font-medium">
                            Download your model
                          </p>
                        </div>
                      </div>
                      <a
                        href={currentJob.modelUrl}
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
                  {currentJob.logsUrl && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-[18px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] p-6 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-[12px] border-[2px] border-slate-900 bg-[#FFD447] flex items-center justify-center shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                          <FileText className="w-6 h-6 text-slate-900" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-900">
                            Training Logs
                          </h3>
                          <p className="text-xs text-slate-600 font-medium">
                            View complete logs
                          </p>
                        </div>
                      </div>
                      <a
                        href={currentJob.logsUrl}
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
                {currentJob.logs && currentJob.logs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-[22px] border-[3px] border-slate-900 bg-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden"
                  >
                    <div className="p-4 border-b-[3px] border-slate-700 flex items-center gap-3">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#fb7185] border-[2px] border-slate-900" />
                        <div className="w-3 h-3 rounded-full bg-[#facc15] border-[2px] border-slate-900" />
                        <div className="w-3 h-3 rounded-full bg-[#22c55e] border-[2px] border-slate-900" />
                      </div>
                      <span className="text-sm font-bold text-white ml-2">
                        Last 10 Logs
                      </span>
                    </div>
                    <div className="p-4 h-64 overflow-y-auto font-mono text-sm text-[#7CF2D0] space-y-1">
                      {currentJob.logs
                        .slice(-10)
                        .map((log: any, index: number) => (
                          <div
                            key={index}
                            className="hover:bg-slate-800 px-2 py-1 rounded-[6px] transition-colors"
                          >
                            {typeof log === "string" ? log : log.message}
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetail;