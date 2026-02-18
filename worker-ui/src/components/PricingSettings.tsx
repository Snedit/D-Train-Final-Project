import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Save, X, AlertCircle, CheckCircle } from 'lucide-react';

interface PricingSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    currentRate: number;
    currentMinCharge: number;
    onUpdate: (rate: number, minCharge: number) => Promise<void>;
}

const PricingSettings: React.FC<PricingSettingsProps> = ({
    isOpen,
    onClose,
    currentRate,
    currentMinCharge,
    onUpdate,
}) => {
    const [rate, setRate] = useState(currentRate.toString());
    const [minCharge, setMinCharge] = useState(currentMinCharge.toString());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const numRate = parseFloat(rate);
            const numMinCharge = parseFloat(minCharge);

            if (isNaN(numRate) || numRate < 0) {
                throw new Error("Invalid hourly rate");
            }

            if (isNaN(numMinCharge) || numMinCharge < 0) {
                throw new Error("Invalid minimum charge");
            }

            await onUpdate(numRate, numMinCharge);
            setSuccess("Pricing updated successfully!");

            setTimeout(() => {
                onClose();
                setSuccess('');
            }, 1500);
        } catch (err: any) {
            setError(err.message || "Failed to update pricing");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-[24px] border-[3px] border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden"
                    >
                        <div className="p-6 bg-[#FEF3C7] border-b-[3px] border-slate-900 flex items-center justify-between">
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                                <DollarSign className="w-6 h-6" />
                                Pricing Settings
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-900" />
                            </button>
                        </div>

                        <div className="p-6">
                            {error && (
                                <div className="mb-4 p-3 rounded-[12px] bg-red-100 border-[2px] border-red-500 text-red-700 text-sm font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="mb-4 p-3 rounded-[12px] bg-green-100 border-[2px] border-green-500 text-green-700 text-sm font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-900 mb-2">
                                        Hourly Rate (₹)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={rate}
                                            onChange={(e) => setRate(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 rounded-[12px] border-[3px] border-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-400/50 font-bold text-lg"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 font-medium">
                                        This is how much you'll charge per hour of compute time.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-900 mb-2">
                                        Minimum Charge (₹)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={minCharge}
                                            onChange={(e) => setMinCharge(e.target.value)}
                                            className="w-full pl-8 pr-4 py-3 rounded-[12px] border-[3px] border-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-400/50 font-bold text-lg"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 font-medium">
                                        The minimum amount you'll receive for any job, regardless of duration.
                                    </p>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-5 py-2.5 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 font-bold hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-[12px] border-[3px] border-slate-900 bg-[#7CF2D0] text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Save className="w-5 h-5" />
                                        )}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PricingSettings;
