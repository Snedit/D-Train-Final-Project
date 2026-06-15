import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Trash2, Save, AlertTriangle, CheckCircle } from 'lucide-react';

interface SettingsModalProps {
  userName: string;
  userEmail: string;
  tokenKey: string;
  userKey: string;
  onClose: () => void;
  onSignOut: () => void;
  onProfileUpdated: (name: string, email: string) => void;
}

const API_BASE = 'http://localhost:5000';

const SettingsModal: React.FC<SettingsModalProps> = ({
  userName,
  userEmail,
  tokenKey,
  userKey,
  onClose,
  onSignOut,
  onProfileUpdated,
}) => {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);

  const hasChanges = name !== userName || email !== userEmail;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaveLoading(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const token = localStorage.getItem(tokenKey);
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      const saved = localStorage.getItem(userKey);
      if (saved) {
        const u = JSON.parse(saved);
        localStorage.setItem(userKey, JSON.stringify({ ...u, name: data.user.name, email: data.user.email }));
      }
      onProfileUpdated(data.user.name, data.user.email);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      const token = localStorage.getItem(tokenKey);
      const res = await fetch(`${API_BASE}/api/user/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      onSignOut();
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-[24px] border-[3px] border-slate-900 bg-[#FFFDF8] shadow-[10px_10px_0_0_rgba(15,23,42,1)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b-[3px] border-slate-900 bg-[#F5F3FF]">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-600 font-medium mt-0.5">Manage your account</p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              onClick={onClose}
              className="w-9 h-9 rounded-[10px] border-[2px] border-slate-900 bg-white flex items-center justify-center shadow-[3px_3px_0_0_rgba(15,23,42,1)] hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4 text-slate-900" />
            </motion.button>
          </div>

          <div className="p-6 space-y-6">

            {/* Profile Section */}
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-[6px] bg-blue-400 border-[2px] border-slate-900 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                Profile
              </h3>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="inline-flex items-center px-2.5 py-1 rounded-full border-[2px] border-slate-900 bg-[#7BC8FF] text-[11px] font-semibold text-slate-900 mb-2">
                    <User className="w-3 h-3 mr-1" />
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="inline-flex items-center px-2.5 py-1 rounded-full border-[2px] border-slate-900 bg-[#FFB4D3] text-[11px] font-semibold text-slate-900 mb-2">
                    <Mail className="w-3 h-3 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:-translate-y-0.5 focus:shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Error / Success */}
                <AnimatePresence>
                  {saveError && (
                    <motion.p
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs font-semibold text-red-600 px-1"
                    >
                      ⚠ {saveError}
                    </motion.p>
                  )}
                  {saveSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-[10px] border-[2px] border-slate-900 bg-[#DCFCE7] text-xs font-semibold text-slate-900"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      Profile updated successfully!
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Save Button */}
                <motion.button
                  whileHover={hasChanges ? { y: -1 } : {}}
                  whileTap={hasChanges ? { y: 0 } : {}}
                  onClick={handleSave}
                  disabled={!hasChanges || saveLoading}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-[12px] border-[3px] border-slate-900 text-sm font-extrabold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all ${
                    !hasChanges
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : saveLoading
                      ? 'bg-[#7CF2D0] text-slate-700 cursor-wait'
                      : 'bg-[#4ADE80] text-slate-900 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]'
                  }`}
                >
                  {saveLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-[2px] border-slate-900 border-t-transparent rounded-full"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-[2px] border-t-[2px] border-dashed border-slate-900/20" />

            {/* Danger Zone */}
            <div>
              <button
                onClick={() => setShowDeleteZone(v => !v)}
                className="w-full flex items-center justify-between text-sm font-extrabold text-red-600 mb-3"
              >
                <span className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[6px] bg-red-100 border-[2px] border-slate-900 flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  Danger Zone
                </span>
              </button>

              <AnimatePresence>
                {showDeleteZone && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-[14px] border-[3px] border-red-400 bg-[#FEF2F2] p-4 space-y-3">
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        This will permanently delete your account and worker registration. Jobs and transaction records are kept for audit purposes. This action <span className="font-extrabold text-red-600">cannot be undone</span>.
                      </p>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                          Type <span className="font-extrabold text-red-600">DELETE</span> to confirm
                        </label>
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={e => setDeleteConfirm(e.target.value)}
                          placeholder="DELETE"
                          className="w-full px-3 py-2.5 rounded-[10px] border-[2px] border-slate-900 bg-white text-sm font-mono font-bold text-slate-900 placeholder-slate-300 focus:outline-none focus:border-red-400 transition-colors"
                        />
                      </div>

                      {deleteError && (
                        <p className="text-xs font-semibold text-red-600">⚠ {deleteError}</p>
                      )}

                      <motion.button
                        whileHover={deleteConfirm === 'DELETE' ? { y: -1 } : {}}
                        whileTap={deleteConfirm === 'DELETE' ? { y: 0 } : {}}
                        onClick={handleDelete}
                        disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border-[2px] border-slate-900 text-sm font-extrabold shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all ${
                          deleteConfirm !== 'DELETE'
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : deleteLoading
                            ? 'bg-red-300 text-slate-700 cursor-wait'
                            : 'bg-red-500 text-white hover:-translate-y-0.5'
                        }`}
                      >
                        {deleteLoading ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-4 h-4 border-[2px] border-white border-t-transparent rounded-full"
                            />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Delete My Account
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsModal;