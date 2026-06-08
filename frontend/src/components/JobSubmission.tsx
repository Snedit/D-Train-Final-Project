import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import {
  Upload, CheckCircle, AlertCircle, FileCode,
  Package, Terminal, Lightbulb, Sparkles, FileText
} from 'lucide-react';

interface JobSubmissionProps {
  onSubmit: (formData: FormData) => Promise<{ success: boolean; jobId?: string; message?: string; tierPrice?: number; isDraft?: boolean }>;
  onBack: () => void;
}

const JobSubmission: React.FC<JobSubmissionProps> = ({ onSubmit, onBack }) => {
  const [jobTitle, setJobTitle]             = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [mainEntry, setMainEntry]           = useState('main.py');
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [error, setError]                   = useState('');
  const [draftSaved, setDraftSaved]         = useState<{ tierPrice: number } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !file.name.endsWith('.zip')) {
      setError('Please upload a .zip file containing your Python project');
      return;
    }

    // Validate zip contents before accepting
    try {
      const zip      = await JSZip.loadAsync(file);
      const files    = Object.keys(zip.files);
      const hasReqs  = files.includes('requirements.txt');
      const hasEntry = files.includes(mainEntry);

      if (!hasReqs) {
        setError('requirements.txt not found in your zip. Please include it.');
        return;
      }
      if (!hasEntry) {
        setError(`Entry file "${mainEntry}" not found in your zip. Check the entry file name above.`);
        return;
      }

      setSelectedFile(file);
      setError('');
      setDraftSaved(null);
    } catch {
      setError('Could not read the zip file. Make sure it is a valid .zip archive.');
    }
  }, [mainEntry]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !jobTitle.trim() || !jobDescription.trim()) {
      setError('Please fill in the title, description and upload a zip file');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('title',        jobTitle.trim());
    formData.append('description',  jobDescription.trim());
    formData.append('mainFileName', mainEntry);
    formData.append('file',         selectedFile);

    const result = await onSubmit(formData);
    if (!result.success) {
      setError(result.message || 'Failed to save draft');
      setIsSubmitting(false);
    } else if (result.tierPrice) {
      setDraftSaved({ tierPrice: result.tierPrice });
      setIsSubmitting(false);
    }
  };

  // Success state — show the draft saved confirmation
  if (draftSaved) {
    return (
      <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
        <div className="relative max-w-lg w-full">
          <div className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]" />
          <div className="relative z-10 px-8 py-10 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 rounded-full border-[3px] border-slate-900 bg-[#FFE66D] flex items-center justify-center mx-auto mb-6 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
              <FileText className="w-10 h-10 text-slate-900" />
            </motion.div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-3">Draft Saved!</h2>
            <p className="text-sm text-slate-700 font-medium mb-2">
              AI priced this job at <span className="font-extrabold text-slate-900">₹{draftSaved.tierPrice}</span>
            </p>
            <p className="text-xs text-slate-600 font-medium mb-8">
              Your job is saved as a draft. Go to your dashboard, top up your wallet if needed, then click <strong>Pay & Publish</strong> when you're ready — workers will see it only after that.
            </p>
            <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={onBack}
              className="w-full px-6 py-4 rounded-[16px] border-[3px] border-slate-900 bg-[#4ADE80] text-slate-900 font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
              Go to Dashboard
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
      <div className="relative max-w-4xl w-full">
        <div className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
          style={{ backgroundImage: 'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
        <motion.div className="absolute -top-8 left-10 w-24 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7BC8FF]"
          animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }} />
        <motion.div className="absolute -bottom-10 right-4 w-28 h-20 rounded-[28px] border-[3px] border-slate-900 bg-[#FF76B8] flex items-center justify-center"
          animate={{ rotate: [8, 4, 8] }} transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}>
          <Package className="w-8 h-8 text-slate-900" />
        </motion.div>
        <motion.div className="absolute top-1/2 -left-10 w-20 h-20 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}>
          <Terminal className="w-7 h-7 text-slate-900" />
        </motion.div>

        <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <img src="/logo.png" alt="DTrain Logo" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-2xl font-extrabold bg-blue-400 bg-clip-text text-transparent">DTrain</span>
            </div>
            <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={onBack}
              className="px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:bg-blue-500 transition-all">
              Back to Dashboard
            </motion.button>
          </nav>

          {/* Header */}
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="mb-8 text-center">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">Submit a training job</h1>
            <p className="text-xs md:text-sm text-slate-700 mt-2 font-medium">
              Upload your zip — AI will price it and save it as a draft. You pay and publish when you're ready.
            </p>
          </motion.div>

          {/* How it works banner */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mb-6 flex items-start gap-3 px-5 py-4 rounded-[16px] border-[3px] border-slate-900 bg-[#FFE66D] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <Sparkles className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-extrabold text-slate-900">How it works</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs font-medium text-slate-800">
                <span>1. Upload your zip here → saved as draft</span>
                <span>2. AI analyses both files and sets the price</span>
                <span>3. Top up wallet if needed</span>
                <span>4. Click <strong>Pay & Publish</strong> on dashboard → workers see it</span>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
            className="grid md:grid-cols-[6fr_4fr] gap-6">

            {/* Form */}
            <div className="rounded-[22px] border-[3px] border-slate-900 bg-white p-5 md:p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
              <form onSubmit={handleSubmit} className="space-y-5">

                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFE66D] text-[11px] font-semibold text-slate-900 mb-2">
                    Job Title <span className="ml-1 text-red-600">*</span>
                  </label>
                  <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFFDF8] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="e.g., CNN Training on CIFAR-10" required />
                </div>

                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#91ff6d] text-[11px] font-semibold text-slate-900 mb-2">
                    Description <span className="ml-1 text-red-600">*</span>
                  </label>
                  <input type="text" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#f8fffc] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="Fine tuning BERT on custom dataset." required />
                </div>

                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7BC8FF] text-[11px] font-semibold text-slate-900 mb-2">
                    Training code bundle (.zip) <span className="ml-1 text-red-600">*</span>
                  </label>
                  <div {...getRootProps()}
                    className={`mt-2 rounded-[16px] border-[3px] border-dashed p-6 md:p-8 text-center cursor-pointer transition-all ${
                      isDragActive ? 'border-slate-900 bg-[#E4ECFF] -translate-y-0.5'
                      : selectedFile ? 'border-[#22C55E] bg-[#DCFCE7]'
                      : 'border-slate-900 bg-[#FFFDF8] hover:bg-[#F9F5FF] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)]'
                    }`}>
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-2">
                      {selectedFile ? (
                        <>
                          <div className="w-12 h-12 rounded-[12px] bg-[#22C55E] border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                            <CheckCircle className="w-7 h-7 text-white" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-900 mt-2">{selectedFile.name}</p>
                          <p className="text-[11px] font-medium text-slate-700">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-[12px] bg-white border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                            <Upload className="w-7 h-7 text-slate-900" />
                          </div>
                          <p className="text-sm font-extrabold text-slate-900 mt-2">
                            {isDragActive ? 'Drop here' : 'Drag & drop your zip'}
                          </p>
                          <p className="text-[11px] font-medium text-slate-700">Must include requirements.txt + entry file</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7CF2D0] text-[11px] font-semibold text-slate-900 mb-2">
                    Main entry file
                  </label>
                  <input type="text" value={mainEntry} onChange={(e) => setMainEntry(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FFFDF8] text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="main.py" />
                </div>

                {error && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 rounded-[14px] border-[3px] border-slate-900 bg-[#FEE2E2] px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-semibold text-slate-900">{error}</span>
                  </motion.div>
                )}

                <motion.button type="submit"
                  disabled={!selectedFile || !jobTitle.trim() || !jobDescription.trim() || isSubmitting}
                  whileHover={(!isSubmitting && selectedFile && jobTitle.trim()) ? { y: -2 } : {}}
                  whileTap={(!isSubmitting && selectedFile && jobTitle.trim()) ? { y: 0 } : {}}
                  className={`w-full inline-flex items-center justify-center px-6 py-4 rounded-[18px] border-[3px] border-slate-900 text-sm md:text-base font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all ${
                    !selectedFile || !jobTitle.trim() || isSubmitting
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#FFE66D] text-slate-900 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-[#FFD447]'
                  }`}>
                  {isSubmitting ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full mr-3" />
                      Uploading & pricing…
                    </>
                  ) : (
                    <><FileText className="w-5 h-5 mr-2" /> Save as Draft</>
                  )}
                </motion.button>
              </form>
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-[20px] border-[3px] border-slate-900 bg-[#7CF2D0] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <FileCode className="w-5 h-5 text-slate-900" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900 mb-3">Zip requirements</h3>
                    <ul className="space-y-2 text-[11px] font-medium text-slate-800">
                      <li className="flex items-start"><span className="mr-2">•</span><span>Must include <code className="px-1 rounded bg-slate-200 border border-slate-900 text-[10px]">requirements.txt</code></span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Must include the entry file (default: main.py)</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>AI reads both files to set the price</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>Code runs in isolated Docker environment</span></li>
                      <li className="flex items-start"><span className="mr-2">•</span><span>No hardcoded absolute paths</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border-[3px] border-slate-900 bg-[#FFB4D3] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 mb-2">Draft → Publish flow</div>
                    <ul className="space-y-1.5 text-[11px] font-medium text-slate-900">
                      <li className="flex items-start"><span className="mr-2">1.</span>Upload here — saved as draft, no charge</li>
                      <li className="flex items-start"><span className="mr-2">2.</span>AI prices the job based on your code</li>
                      <li className="flex items-start"><span className="mr-2">3.</span>Top up wallet if needed</li>
                      <li className="flex items-start"><span className="mr-2">4.</span>Pay & Publish on dashboard</li>
                      <li className="flex items-start"><span className="mr-2">5.</span>Workers see it and start training</li>
                      <li className="flex items-start"><span className="mr-2">6.</span>Charged only on successful completion</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border-[3px] border-slate-900 bg-[#FFE66D] p-5 shadow-[6px_6px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[12px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 mb-1">Pro tip</div>
                    <p className="text-[11px] font-medium text-slate-900">
                      Test with a small dataset first. Once it runs correctly, scale up and publish the real job.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default JobSubmission;