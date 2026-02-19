import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, Send, FileCode, Package, Terminal, Lightbulb } from 'lucide-react';

interface JobSubmissionProps {
  // FIX: renamed from onJobSubmitted/onBackToDashboard to match App.tsx
  onSubmit: (formData: FormData) => Promise<{ success: boolean; jobId?: string; message?: string }>;
  onBack: () => void;
}

const JobSubmission: React.FC<JobSubmissionProps> = ({ onSubmit, onBack }) => {
  const [jobTitle, setjobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [mainEntry, setMainEntry] = useState('main.py');
  const [requirementsFile, setRequirementsFile] = useState('requirements.txt');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.name.endsWith('.zip')) {
      setSelectedFile(file);
      setError('');
    } else {
      setError('Please upload a .zip file containing your Python project');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !jobTitle.trim() || !jobDescription.trim()) {
      setError('Please provide a job title, description & upload a zip file');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('title', jobTitle.trim());
    formData.append('description', jobDescription.trim());
    formData.append('mainFileName', mainEntry);
    formData.append('file', selectedFile);

    // FIX: delegate to App.tsx's onSubmit handler instead of fetching directly
    const result = await onSubmit(formData);
    if (!result.success) {
      setError(result.message || 'Failed to submit job');
      setIsSubmitting(false);
    }
    // On success, App.tsx handles navigation
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
      <div className="relative max-w-4xl w-full">
        {/* Outer brutalist frame with grid background */}
        <div
          className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Memphis-style playful shapes */}
        <motion.div
          className="absolute -top-8 left-10 w-24 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7BC8FF]"
          initial={{ rotate: -8, y: -4 }}
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-10 right-4 w-28 h-20 rounded-[28px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
          initial={{ rotate: 8 }}
          animate={{ rotate: [8, 4, 8] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
        >
          <Package className="w-8 h-8 text-slate-900" />
        </motion.div>
        <motion.div
          className="absolute top-1/2 -left-10 w-20 h-20 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        >
          <Terminal className="w-7 h-7 text-slate-900" />
        </motion.div>

        {/* Main card content */}
        <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
          {/* Top nav */}
          <nav
            className="flex items-center justify-between mb-8"
            style={{ animation: 'slideDown 0.6s ease-out' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <img src="/logo.png" alt="DTrain Logo" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">
                DTrain
              </span>
            </div>

            {/* FIX: was onBackToDashboard, now onBack */}
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              onClick={onBack}
              className="px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
            >
              Back to Dashboard
            </motion.button>
          </nav>

          {/* Header Section */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8"
          >
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
                Submit a new training job
              </h1>
              <p className="text-xs md:text-sm text-slate-700 mt-2 font-medium">
                Bundle your Python project into a zip, plug in the entrypoint, and
                we&apos;ll ship it to the network.
              </p>
            </div>
          </motion.div>

          {/* Content layout */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-[6fr_4fr] gap-6"
          >
            {/* Left: form */}
            <div className="rounded-[22px] border-[3px] border-slate-900 bg-white p-5 md:p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Job title */}
                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFE66D] text-[11px] font-semibold text-slate-900 mb-2">
                    Job Title <span className="ml-1 text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setjobTitle(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFFDF8] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="e.g., CNN Training on CIFAR-10"
                    required
                  />
                </div>

                {/* Job description */}
                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#91ff6d] text-[11px] font-semibold text-slate-900 mb-2">
                    Job Description <span className="ml-1 text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#f8fffc] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="Fine tuning the dataset."
                    required
                  />
                </div>

                {/* File upload */}
                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7BC8FF] text-[11px] font-semibold text-slate-900 mb-2">
                    Training code bundle (.zip) <span className="ml-1 text-red-600">*</span>
                  </label>
                  <div
                    {...getRootProps()}
                    className={`mt-2 rounded-[16px] border-[3px] border-dashed p-6 md:p-8 text-center cursor-pointer transition-all ${
                      isDragActive
                        ? 'border-slate-900 bg-[#E4ECFF] -translate-y-0.5'
                        : selectedFile
                        ? 'border-[#22C55E] bg-[#DCFCE7]'
                        : 'border-slate-900 bg-[#FFFDF8] hover:bg-[#F9F5FF] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-2">
                      {selectedFile ? (
                        <>
                          <div className="w-12 h-12 rounded-[12px] bg-[#22C55E] border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                            <CheckCircle className="w-7 h-7 text-white" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-900 mt-2">{selectedFile.name}</p>
                          <p className="text-[11px] font-medium text-slate-700">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • zip archive
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-[12px] bg-white border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                            <Upload className="w-7 h-7 text-slate-900" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-900 mt-2">
                            {isDragActive ? 'Drop your zip file here' : 'Drag & drop your zip file here'}
                          </p>
                          <p className="text-[11px] font-medium text-slate-700">
                            or click to browse from your machine
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Config fields */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7CF2D0] text-[11px] font-semibold text-slate-900 mb-2">
                      Main entry file
                    </label>
                    <input
                      type="text"
                      value={mainEntry}
                      onChange={(e) => setMainEntry(e.target.value)}
                      className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFFDF8] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                      placeholder="main.py"
                    />
                  </div>
                  <div>
                    <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFB4D3] text-[11px] font-semibold text-slate-900 mb-2">
                      Requirements file
                    </label>
                    <input
                      type="text"
                      value={requirementsFile}
                      disabled
                      onChange={(e) => setRequirementsFile(e.target.value)}
                      className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFFDF8] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                      placeholder="requirements.txt"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FEE2E2] px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                  >
                    <div className="w-5 h-5 rounded-full bg-red-500 border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-slate-900">{error}</span>
                  </motion.div>
                )}

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={!selectedFile || !jobTitle.trim() || isSubmitting}
                  whileHover={!isSubmitting && selectedFile && jobTitle.trim() ? { y: -2 } : {}}
                  whileTap={!isSubmitting && selectedFile && jobTitle.trim() ? { y: 0 } : {}}
                  className={`w-full inline-flex items-center justify-center px-6 py-4 rounded-[18px] border-[3px] border-slate-900 text-sm md:text-base font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all ${
                    !selectedFile || !jobTitle.trim() || isSubmitting
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#4ADE80] text-slate-900 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-[#22C55E] active:shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full mr-3"
                      />
                      Submitting job…
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Submit Training Job
                    </>
                  )}
                </motion.button>
              </form>
            </div>

            {/* Right: guidelines / info */}
            <div className="flex flex-col gap-4">
              <div className="rounded-[20px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <FileCode className="w-5 h-5 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900 mb-3">Preparation guidelines</h3>
                    <ul className="space-y-2 text-[11px] font-medium text-slate-800">
                      <li className="flex items-start"><span className="mr-2">•</span><span>Ensure your zip file contains all Python source code</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Include a <code className="px-1 py-0.5 rounded bg-slate-200 border border-slate-900 text-[10px]">requirements.txt</code> with all dependencies</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Specify the correct main entry point file (default: main.py)</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Your code will run in an isolated Docker environment</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Avoid hardcoded absolute paths in your code</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-extrabold text-slate-900 mb-2">Pro tip</div>
                    <p className="text-[11px] font-medium text-slate-900 mb-3">
                      Start with a tiny dataset slice and fewer epochs. Once the job shape looks right,
                      bump the scale and let the network flex.
                    </p>
                    <div className="inline-flex items-center px-3 py-1.5 rounded-[12px] border-[2px] border-slate-900 bg-white text-[10px] font-semibold text-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                      <span className="w-4 h-4 rounded-full bg-[#22C55E] border-[2px] border-slate-900 mr-2 flex-shrink-0" />
                      Most jobs stabilize after 2–3 dry runs
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-25px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default JobSubmission;