import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, UserPlus } from 'lucide-react';

interface SignUpProps {
  onSignUp: (name: string, email: string, password: string) => void;
  onSwitchToSignIn: () => void;
}

const SignUp: React.FC<SignUpProps> = ({ onSignUp, onSwitchToSignIn }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      await onSignUp(name, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] flex items-center justify-center px-4 py-10">
      <div className="relative max-w-md w-full">
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
          className="absolute -top-6 -left-6 w-20 h-20 rounded-[20px] border-[3px] border-slate-900 bg-[#7CF2D0]"
          animate={{ rotate: [6, -6, 6] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-6 -right-6 w-24 h-16 rounded-full border-[3px] border-slate-900 bg-[#FFB4D3]"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        />

        {/* Main content */}
        <div className="relative z-10 px-8 py-8">
          {/* Logo/Branding */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[14px] bg-blue-400 border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <img 
                  src="/logo.png" 
                  alt="DTrain Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <span className="text-3xl font-extrabold text-slate-900">DTrain</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7CF2D0] text-[11px] font-semibold text-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)] mb-3">
              Get Started
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">
              Create Account
            </h1>
            <p className="text-sm text-slate-700 font-medium">
              Join the decentralized ML training network
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFE66D] text-[11px] font-semibold text-slate-900 mb-2">
                <User className="w-3 h-3 mr-1" />
                Full Name
              </label>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                  placeholder="John Doe"
                  required
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#7BC8FF] text-[11px] font-semibold text-slate-900 mb-2">
                <Mail className="w-3 h-3 mr-1" />
                Email Address
              </label>
              <div className="relative mt-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                  placeholder="your@email.com"
                  required
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFB4D3] text-[11px] font-semibold text-slate-900 mb-2">
                <Lock className="w-3 h-3 mr-1" />
                Password
              </label>
              <div className="relative mt-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                  placeholder="••••••••"
                  required
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFB4D3] text-[11px] font-semibold text-slate-900 mb-2">
                <Lock className="w-3 h-3 mr-1" />
                Confirm Password
              </label>
              <div className="relative mt-2">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0 focus:border-slate-900 focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                  placeholder="••••••••"
                  required
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[14px] border-[3px] border-slate-900 bg-[#FEE2E2] px-4 py-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
              >
                <p className="text-xs font-semibold text-slate-900">{error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={!isLoading ? { y: -2 } : {}}
              whileTap={!isLoading ? { y: 0 } : {}}
              className={`w-full flex items-center justify-center px-6 py-4 rounded-[16px] border-[3px] border-slate-900 text-sm font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all ${
                isLoading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-400 text-white hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-blue-500'
              }`}
            >
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full mr-2"
                  />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Account
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-[2px] border-t-[2px] border-dashed border-slate-900" />
            <span className="text-xs font-bold text-slate-700">OR</span>
            <div className="flex-1 h-[2px] border-t-[2px] border-dashed border-slate-900" />
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-sm text-slate-700 font-medium mb-3">
              Already have an account?
            </p>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              onClick={onSwitchToSignIn}
              className="inline-flex items-center px-6 py-3 rounded-[14px] border-[3px] border-slate-900 bg-white text-slate-900 text-sm font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
            >
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
