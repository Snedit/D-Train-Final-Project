import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, Cpu, HardDrive, Zap, AlertCircle, LogOut } from 'lucide-react';

interface WorkerRegistrationProps {
  onRegister: () => Promise<void>;
  onSignOut?: () => void;
}

interface DeviceInfo {
  os: string;
  cpu: string;
  ram: string;
  gpu?: string;
}

const WorkerRegistration: React.FC<WorkerRegistrationProps> = ({ 
  onRegister,
  onSignOut,
}) => {
  const [loading, setLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchDeviceInfo();
  }, []);

  const fetchDeviceInfo = async () => {
    try {
      if (window.electron) {
        const info = await window.electron.getDeviceInfo();
        setDeviceInfo(info);
      } else {
        // Browser fallback
        setDeviceInfo({
          os: navigator.platform || 'Web Browser',
          cpu: `${navigator.hardwareConcurrency || 4} cores`,
          ram: `${(navigator as any).deviceMemory || 8}GB`,
          gpu: 'WebGL GPU',
        });
      }
    } catch (err) {
      console.error('Failed to fetch device info:', err);
      setError('Failed to get device information');
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      await onRegister();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
      <div className="relative max-w-lg w-full">
        {/* Grid background card */}
        <div
          className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {/* Memphis shapes */}
        <motion.div
          className="absolute -top-6 -left-6 w-20 h-20 rounded-[20px] border-[3px] border-slate-900 bg-[#7CF2D0]"
          animate={{ rotate: [6, -6, 6] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-6 -right-6 w-24 h-16 rounded-full border-[3px] border-slate-900 bg-[#FFD447]"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        />

        {/* Main content */}
        <div className="relative z-10 px-8 py-8">
          {/* Top Nav - Logo and Sign Out Button */}
          <nav className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <img 
                  src="logo.png" 
                  alt="DTrain Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-2xl font-extrabold text-slate-900">
                DTrain
              </span>
            </div>

            {/* Sign Out Button - Only show if onSignOut is provided */}
            {onSignOut && (
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                onClick={onSignOut}
                className="flex items-center gap-2 px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:bg-blue-500 active:translate-y-0"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </motion.button>
            )}
          </nav>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">
              Register as Worker
            </h1>
            <p className="text-sm text-slate-700 font-medium">
              Register your device to start earning by processing training jobs
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[14px] border-[3px] border-slate-900 bg-[#FEE2E2] px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)] mb-6"
            >
              <p className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </p>
            </motion.div>
          )}

          {/* Device Info Preview */}
          {deviceInfo ? (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-4 rounded-[14px] border-[3px] border-slate-900 bg-[#F0F9FF] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <div className="w-10 h-10 rounded-[10px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                  <Server className="w-5 h-5 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-600 mb-0.5">Operating System</p>
                  <p className="text-sm font-bold text-slate-900">{deviceInfo.os}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-[14px] border-[3px] border-slate-900 bg-[#FEF3C7] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <div className="w-10 h-10 rounded-[10px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-600 mb-0.5">CPU</p>
                  <p className="text-sm font-bold text-slate-900">{deviceInfo.cpu}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-[14px] border-[3px] border-slate-900 bg-[#DCFCE7] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <div className="w-10 h-10 rounded-[10px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                  <HardDrive className="w-5 h-5 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-600 mb-0.5">RAM</p>
                  <p className="text-sm font-bold text-slate-900">{deviceInfo.ram}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-[14px] border-[3px] border-slate-900 bg-[#FCE7F3] shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <div className="w-10 h-10 rounded-[10px] bg-white border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-600 mb-0.5">GPU</p>
                  <p className="text-sm font-bold text-slate-900">{deviceInfo.gpu || 'N/A'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12 mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-[3px] border-slate-900 border-t-transparent rounded-full"
              />
            </div>
          )}

          {/* Register Button */}
          <motion.button
            whileHover={!loading && deviceInfo ? { y: -2 } : {}}
            whileTap={!loading && deviceInfo ? { y: 0 } : {}}
            onClick={handleRegister}
            disabled={loading || !deviceInfo}
            className={`w-full flex items-center justify-center px-6 py-4 rounded-[16px] border-[3px] border-slate-900 text-sm font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all ${
              loading || !deviceInfo
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-400 text-slate-900 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
            }`}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full mr-2"
                />
                Registering...
              </>
            ) : (
              <>
                <Server className="w-5 h-5 mr-2" />
                Register Device
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default WorkerRegistration;
