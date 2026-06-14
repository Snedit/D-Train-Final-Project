import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, ChevronDown } from 'lucide-react';

interface ProfileDropdownProps {
  onSignOut: () => void;
  onSettings?: () => void;
  userName?: string;
  userEmail?: string;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  onSignOut,
  onSettings,
  userName = 'User',
  userEmail = 'user@example.com'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ y: 0 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] h-[38px]"
      >
        <div className="w-6 h-6 rounded-[6px] bg-blue-400 border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-extrabold text-white leading-none">
            {getInitials(userName)}
          </span>
        </div>
        <span className="hidden sm:block text-sm font-bold text-slate-900 max-w-[80px] truncate">
          {userName.split(' ')[0]}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-slate-900" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-64 rounded-[16px] border-[3px] border-slate-900 bg-white shadow-[6px_6px_0_0_rgba(15,23,42,1)] overflow-hidden z-50"
          >
            <div className="p-4 border-b-[2px] border-slate-900 bg-[#F5F3FF]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-[12px] bg-blue-400 border-[2px] border-slate-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-extrabold text-white">
                    {getInitials(userName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{userName}</p>
                  <p className="text-xs text-slate-600 font-medium truncate">{userEmail}</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left hover:bg-[#F5F3FF] transition-colors group"
                onClick={() => {
                  setIsOpen(false);
                  onSettings?.();
                }}
              >
                <div className="w-8 h-8 rounded-[8px] bg-[#E4ECFF] border-[2px] border-slate-900 flex items-center justify-center group-hover:bg-blue-400 transition-colors">
                  <Settings className="w-4 h-4 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Settings</p>
                  <p className="text-xs text-slate-600">Manage your account</p>
                </div>
              </motion.button>

              <div className="my-2 h-[2px] bg-slate-900/10" />

              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left hover:bg-[#FEE2E2] transition-colors group"
                onClick={() => {
                  setIsOpen(false);
                  onSignOut();
                }}
              >
                <div className="w-8 h-8 rounded-[8px] bg-[#FEE2E2] border-[2px] border-slate-900 flex items-center justify-center group-hover:bg-red-400 transition-colors">
                  <LogOut className="w-4 h-4 text-slate-900" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Sign Out</p>
                  <p className="text-xs text-slate-600">Logout from DTrain</p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileDropdown;