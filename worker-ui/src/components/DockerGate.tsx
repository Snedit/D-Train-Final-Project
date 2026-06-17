import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ExternalLink, CheckCircle, AlertCircle, Loader } from "lucide-react";

interface DockerGateProps {
  onDockerReady: () => void;
}

type Status = "checking" | "running" | "stopped" | "launching" | "not_installed";

const DockerGate: React.FC<DockerGateProps> = ({ onDockerReady }) => {
  const [status, setStatus] = useState<Status>("checking");
  const [pollCount, setPollCount] = useState(0);

  const checkDocker = async () => {
    setStatus("checking");
    try {
      const isRunning = await (window as any).worker.checkDocker();
      if (isRunning) {
        setStatus("running");
        setTimeout(onDockerReady, 1000);
      } else {
        setStatus("stopped");
      }
    } catch {
      setStatus("stopped");
    }
  };

  useEffect(() => {
    checkDocker();
  }, []);

  useEffect(() => {
    if (status !== "launching") return;
    const interval = setInterval(async () => {
      setPollCount((c) => c + 1);
      try {
        const isRunning = await (window as any).worker.checkDocker();
        if (isRunning) {
          setStatus("running");
          clearInterval(interval);
          setTimeout(onDockerReady, 1000);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [status]);

  const handleLaunch = async () => {
    setStatus("launching");
    try {
      const result = await (window as any).worker.launchDocker();
      if (!result.installed) {
        setStatus("not_installed");
      }
    } catch {
      setStatus("stopped");
    }
  };

  const dots = ".".repeat((pollCount % 3) + 1);

  return (
    <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Main card */}
        <div className="bg-white rounded-[20px] border-[3px] border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-8">
          <AnimatePresence mode="wait">

            {status === "checking" && (
              <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-[14px] border-[3px] border-slate-900 bg-[#FFD447] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-center">
                    <Loader className="w-7 h-7 text-slate-900 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Checking Docker</h2>
                    <p className="text-slate-500 font-medium">Just a moment...</p>
                  </div>
                </div>
              </motion.div>
            )}

            {status === "stopped" && (
              <motion.div key="stopped" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-[14px] border-[3px] border-slate-900 bg-[#FF76B8] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-slate-900" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Docker Not Running</h2>
                    <p className="text-slate-500 font-medium">DTrain needs Docker to run training jobs</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleLaunch}
                    className="w-full py-3 px-6 rounded-[12px] border-[3px] border-slate-900 bg-[#FFD447] font-black text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all flex items-center justify-center gap-2 text-base"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Launch Docker Desktop
                  </button>
                  <button
                    onClick={checkDocker}
                    className="w-full py-3 px-6 rounded-[12px] border-[3px] border-slate-900 bg-white font-black text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all flex items-center justify-center gap-2 text-base"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Check Again
                  </button>
                </div>
              </motion.div>
            )}

            {status === "launching" && (
              <motion.div key="launching" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-[14px] border-[3px] border-slate-900 bg-[#FFD447] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-center">
                    <Loader className="w-7 h-7 text-slate-900 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Starting Docker{dots}</h2>
                    <p className="text-slate-500 font-medium">Waiting for Docker to be ready</p>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full border-[2px] border-slate-900 h-4 overflow-hidden">
                  <motion.div
                    className="h-full bg-[#FFD447] rounded-full"
                    animate={{ width: ["5%", "85%"] }}
                    transition={{ duration: 40, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            )}

            {status === "running" && (
              <motion.div key="running" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-[14px] border-[3px] border-slate-900 bg-[#7CF2D0] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-slate-900" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Docker is Running!</h2>
                    <p className="text-slate-500 font-medium">Launching DTrain Worker...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600 font-semibold">
                  <motion.div
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="w-3 h-3 rounded-full bg-[#7CF2D0] border-[2px] border-slate-900"
                  />
                  Entering dashboard...
                </div>
              </motion.div>
            )}

            {status === "not_installed" && (
              <motion.div key="not_installed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-[14px] border-[3px] border-slate-900 bg-[#FF76B8] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-slate-900" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Docker Not Installed</h2>
                    <p className="text-slate-500 font-medium">Please install Docker Desktop to use DTrain</p>
                  </div>
                </div>
                <a
                  href="https://www.docker.com/products/docker-desktop/"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-6 rounded-[12px] border-[3px] border-slate-900 bg-[#FFD447] font-black text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all flex items-center justify-center gap-2 text-base"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download Docker Desktop
                </a>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DockerGate;