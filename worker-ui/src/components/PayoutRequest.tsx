import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, CheckCircle, XCircle, Banknote, Info, X } from 'lucide-react';

interface PayoutRequestProps {
  walletBalance: number;
  hasStripeAccount: boolean;
  onPayoutSuccess: (newBalance: number) => void;
  onClose: () => void;
}

const API_BASE = 'http://localhost:5000/api/payment';

const PayoutRequest: React.FC<PayoutRequestProps> = ({
  walletBalance,
  hasStripeAccount,
  onPayoutSuccess,
  onClose,
}) => {
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const quickAmounts = [100, 250, 500].filter((q) => q <= walletBalance);

  const handlePayout = async () => {
    const payoutAmount = parseFloat(amount);
    if (!payoutAmount || payoutAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (payoutAmount > walletBalance) {
      setError(`Cannot exceed wallet balance (₹${walletBalance.toFixed(2)})`);
      return;
    }
    if (payoutAmount < 50) {
      setError('Minimum payout is ₹50');
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('dtrain_worker_token');
      const res = await fetch(`${API_BASE}/worker/payout-request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: payoutAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Payout failed');
        return;
      }

      setSuccess(
        hasStripeAccount
          ? `₹${payoutAmount.toFixed(2)} payout initiated to your bank account!`
          : `₹${payoutAmount.toFixed(2)} payout request recorded. Connect a Stripe account for instant payouts.`
      );
      onPayoutSuccess(data.newWalletBalance);
      setAmount('');
    } catch (err: any) {
      setError(err.message || 'Payout failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-md mx-auto bg-white rounded-[24px] border-[3px] border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 bg-[#7CF2D0] border-b-[3px] border-slate-900 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Banknote className="w-6 h-6" />
          Request Payout
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-900" />
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Balance display */}
        <div className="rounded-[14px] border-[3px] border-slate-900 bg-[#FFD447] px-5 py-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">
            Available Balance
          </p>
          <p className="text-3xl font-extrabold text-slate-900">₹{walletBalance.toFixed(2)}</p>
        </div>

        {/* Stripe connect notice */}
        {!hasStripeAccount && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-[12px] border-[2px] border-dashed border-[#635BFF] bg-[#EEF2FF]">
            <Info className="w-4 h-4 text-[#635BFF] flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-[#635BFF] leading-relaxed">
              Connect a Stripe account to receive instant bank payouts.
              Without it, payout requests are queued for manual processing.
            </p>
          </div>
        )}
        {hasStripeAccount && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] border-[2px] border-green-300 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-green-700">
              Stripe account connected — payouts go straight to your bank.
            </p>
          </div>
        )}

        {/* Quick amount buttons */}
        {quickAmounts.length > 0 && (
          <div className="flex gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q.toString())}
                className={`flex-1 py-2 rounded-[10px] border-[2px] border-slate-900 text-sm font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all ${
                  amount === q.toString()
                    ? 'bg-[#635BFF] text-white'
                    : 'bg-white text-slate-900 hover:bg-[#EEF2FF]'
                }`}
              >
                ₹{q}
              </button>
            ))}
            <button
              onClick={() => setAmount(walletBalance.toFixed(2))}
              className={`flex-1 py-2 rounded-[10px] border-[2px] border-slate-900 text-sm font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all ${
                amount === walletBalance.toFixed(2)
                  ? 'bg-[#635BFF] text-white'
                  : 'bg-white text-slate-900 hover:bg-[#EEF2FF]'
              }`}
            >
              All
            </button>
          </div>
        )}

        {/* Custom amount */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-2">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            min="50"
            max={walletBalance}
            step="1"
            placeholder="Min ₹50"
            className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] focus:outline-none focus:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
          />
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-4 py-3 rounded-[12px] border-[2px] border-red-300 bg-[#FEE2E2]"
            >
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-4 py-3 rounded-[12px] border-[2px] border-green-300 bg-[#DCFCE7]"
            >
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-700">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button
          whileHover={{ y: -2 }} whileTap={{ y: 0 }}
          onClick={handlePayout}
          disabled={processing || !amount}
          className="w-full py-4 rounded-[14px] border-[3px] border-slate-900 bg-[#7CF2D0] text-slate-900 font-extrabold text-base shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-[3px] border-slate-900 border-t-transparent rounded-full"
              />
              Processing...
            </>
          ) : (
            <>
              <ArrowUpRight className="w-5 h-5" />
              Request Payout
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default PayoutRequest;