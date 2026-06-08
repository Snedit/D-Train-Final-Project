import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet as WalletIcon, CreditCard, History, TrendingUp, CheckCircle, XCircle, X, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

interface Transaction {
  id: string;
  type: 'topup' | 'reservation' | 'charge' | 'refund' | 'withdrawal' | 'worker_payout';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
}

interface WalletProps {
  onBack: () => void;
}

// All tier values — shown as quick-select buttons so user can top up the exact amount needed
const TIER_QUICK_SELECT = [50, 100, 150, 200, 300, 400, 500];

const API_BASE = 'http://localhost:5000/api/payment';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
  const [balance,   setBalance]   = useState(0);
  const [reserved,  setReserved]  = useState(0);
  const [available, setAvailable] = useState(0);
  const [amount,    setAmount]    = useState('100');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  const [checkoutOpen,      setCheckoutOpen]      = useState(false);
  const [clientSecret,      setClientSecret]      = useState<string | null>(null);
  const [pendingSessionId,  setPendingSessionId]  = useState<string | null>(null);

  const getTransactionColor = (type: Transaction['type']) => {
    const colors: Record<string, string> = {
      topup:        'bg-[#7CF2D0] text-slate-900',
      reservation:  'bg-[#FFE66D] text-slate-900',
      charge:       'bg-[#FEE2E2] text-slate-900',
      refund:       'bg-[#4ADE80] text-slate-900',
      withdrawal:   'bg-[#FDE68A] text-slate-900',
      worker_payout:'bg-[#BBF7D0] text-slate-900',
    };
    return colors[type] || 'bg-slate-200 text-slate-900';
  };

  const fetchWalletData = useCallback(async () => {
    try {
      const token = localStorage.getItem('dtrain_token');
      const [balanceRes, txRes] = await Promise.all([
        fetch(`${API_BASE}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/wallet/transactions?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (balanceRes.ok) {
        const d = await balanceRes.json();
        setBalance(d.balance ?? 0);
        setReserved(d.reserved ?? 0);
        setAvailable(d.available ?? d.balance ?? 0);
      }
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions || []);
      }
    } catch {
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyStripeSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('dtrain_token');
      const res = await fetch(`${API_BASE}/stripe/verify`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.newBalance !== undefined && data.newBalance !== null) {
        setBalance(data.newBalance);
        setReserved(data.reserved ?? 0);
        setAvailable(data.available ?? data.newBalance);
        setSuccess('Wallet recharged successfully!');
        fetchWalletData();
      } else if (data.message === 'Already processed') {
        fetchWalletData();
      } else {
        setError(data.message || 'Payment verification failed');
      }
    } catch {
      setError('Failed to verify payment');
    }
  };

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const status    = params.get('status');
    if (status === 'cancelled') {
      setError('Payment was cancelled. No charge was made.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (sessionId && status === 'success') {
      verifyStripeSession(sessionId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const rechargeAmount = parseFloat(amount);
    const token = localStorage.getItem('dtrain_token');
    const res = await fetch(`${API_BASE}/wallet/topup`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ amount: rechargeAmount }),
    });
    const data = await res.json();
    if (!data.clientSecret) throw new Error(data.message || 'Failed to create checkout session');
    setPendingSessionId(data.sessionId);
    return data.clientSecret;
  }, [amount]);

  const handleRecharge = async () => {
    const rechargeAmount = parseFloat(amount);
    if (!rechargeAmount || rechargeAmount < 10) {
      setError('Minimum recharge amount is ₹10');
      return;
    }
    setProcessing(true);
    setError('');
    setSuccess('');
    try {
      const secret = await fetchClientSecret();
      setClientSecret(secret);
      setCheckoutOpen(true);
    } catch (err: any) {
      setError(err.message || 'Recharge failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckoutComplete = async () => {
    setCheckoutOpen(false);
    setClientSecret(null);
    if (pendingSessionId) {
      await verifyStripeSession(pendingSessionId);
      setPendingSessionId(null);
    }
    // Always re-fetch to make sure balance is fresh
    await fetchWalletData();
  };

  const handleCloseModal = async () => {
    setCheckoutOpen(false);
    setClientSecret(null);
    // Cancel the pending transaction in the DB so it doesn't sit as "pending" forever
    if (pendingSessionId) {
      try {
        const token = localStorage.getItem('dtrain_token');
        await fetch(`${API_BASE}/stripe/cancel`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sessionId: pendingSessionId }),
        });
      } catch (_) {}
    }
    setPendingSessionId(null);
  };


  useEffect(() => { fetchWalletData(); }, [fetchWalletData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-[#60A5FA] shadow-[6px_6px_0_0_rgba(15,23,42,1)]" />
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-4 rounded-full border-[4px] border-slate-900 bg-[#FFD447]" />
          </div>
          <p className="text-lg font-extrabold text-slate-900">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Stripe Embedded Checkout Modal ── */}
      <AnimatePresence>
        {checkoutOpen && clientSecret && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.7)' }}>
            <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] border-[3px] border-slate-900 bg-white shadow-[12px_12px_0_0_rgba(15,23,42,1)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b-[2px] border-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-[#635BFF] border-[2px] border-slate-900 flex items-center justify-center shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-extrabold text-slate-900 text-lg">Recharge ₹{amount}</span>
                </div>
                <button onClick={handleCloseModal}
                  className="w-9 h-9 rounded-full border-[2px] border-slate-900 bg-[#FEE2E2] flex items-center justify-center hover:bg-red-200 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <X className="w-4 h-4 text-slate-900" />
                </button>
              </div>
              <div className="p-4">
                <EmbeddedCheckoutProvider stripe={stripePromise}
                  options={{ clientSecret, onComplete: handleCheckoutComplete }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Wallet Page ── */}
      <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
              style={{ backgroundImage: `linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)`, backgroundSize: '26px 26px' }} />
            <motion.div className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
              <TrendingUp className="w-8 h-8 text-slate-900" />
            </motion.div>
            <motion.div className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
              animate={{ y: [0, -6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div className="absolute top-1/3 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#A8E6CF] flex items-center justify-center"
              animate={{ rotate: [6, -6, 6] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
              <WalletIcon className="w-8 h-8 text-slate-900" />
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
                  className="flex items-center px-6 py-2 rounded-[12px] border-[3px] border-slate-900 bg-blue-400 text-white text-sm font-semibold shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:bg-blue-500 transition-all">
                  Back to Dashboard
                </motion.button>
              </nav>

              {/* Balance + Recharge */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

                {/* Balance Card — shows total / reserved / available */}
                <motion.div whileHover={{ y: -2 }}
                  className="lg:col-span-1 rounded-[22px] border-[3px] border-slate-900 bg-gradient-to-br from-[#A8E6CF] to-[#7CF2D0] p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-slate-900" />
                    <p className="text-sm font-bold text-slate-900">Wallet Balance</p>
                  </div>

                  {/* Available (spendable) — the big number */}
                  <p className="text-5xl font-extrabold text-slate-900 mb-1">₹{available.toFixed(2)}</p>
                  <p className="text-xs font-bold text-slate-700 mb-5">Available to spend</p>

                  {/* Reserved breakdown */}
                  {reserved > 0 && (
                    <div className="rounded-[14px] border-[2px] border-slate-900 bg-white/60 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="w-3.5 h-3.5 text-slate-700" />
                        <p className="text-xs font-bold text-slate-700">Reserved for active jobs</p>
                      </div>
                      <p className="text-lg font-extrabold text-slate-900">₹{reserved.toFixed(2)}</p>
                      <p className="text-[10px] text-slate-600 font-medium mt-0.5">Released when jobs complete or cancel</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mt-2">
                    <span>Total in wallet:</span>
                    <span className="font-extrabold text-slate-900">₹{balance.toFixed(2)}</span>
                  </div>
                </motion.div>

                {/* Recharge Card */}
                <div className="lg:col-span-2 rounded-[22px] border-[3px] border-slate-900 bg-white p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                  <div className="flex items-center gap-2 mb-5">
                    <CreditCard className="w-5 h-5 text-slate-900" />
                    <h2 className="text-xl font-extrabold text-slate-900">Recharge Wallet</h2>
                    <span className="ml-auto px-3 py-1 rounded-full border-[2px] border-slate-900 bg-[#635BFF] text-white text-[10px] font-extrabold tracking-wide shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                      Powered by Stripe
                    </span>
                  </div>

                  {/* Tier quick-select — all 12 tiers so you can top up the exact amount needed */}
                  <p className="text-xs font-bold text-slate-600 mb-2">Job tiers — quick select:</p>
                  <div className="grid grid-cols-6 gap-2 mb-5">
                    {TIER_QUICK_SELECT.map((q) => (
                      <motion.button key={q} whileHover={{ y: -2 }} whileTap={{ y: 0 }}
                        onClick={() => setAmount(q.toString())}
                        className={`px-2 py-2 rounded-[10px] border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-all ${
                          amount === q.toString()
                            ? 'bg-[#635BFF] text-white'
                            : 'bg-white text-slate-900 hover:bg-[#EEF2FF]'
                        }`}>
                        ₹{q}
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom amount */}
                  <div className="mb-5">
                    <label className="block text-sm font-bold text-slate-900 mb-2">Custom Amount (₹)</label>
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                      min="10"
                      className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] focus:outline-none focus:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
                      placeholder="Enter amount (min ₹10)" />
                  </div>

                  {/* Pay button */}
                  <motion.button whileHover={{ y: -2 }} whileTap={{ y: 0 }} onClick={handleRecharge} disabled={processing}
                    className="w-full px-6 py-4 rounded-[14px] border-[3px] border-slate-900 bg-[#635BFF] text-white text-lg font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-[#5249E5] disabled:opacity-50 disabled:cursor-not-allowed">
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full" />
                        Opening payment...
                      </span>
                    ) : `Pay ₹${amount || '—'} with Stripe →`}
                  </motion.button>

                </div>
              </div>

              {/* Status Messages */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#FEE2E2] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span className="font-bold text-slate-900">{error}</span>
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#7CF2D0] shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-800 flex-shrink-0" />
                  <span className="font-bold text-slate-900">{success}</span>
                </motion.div>
              )}

              {/* Transaction History */}
              <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
                <div className="p-6 border-b-[3px] border-slate-900 bg-[#F5F3FF]">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-900" />
                    <h2 className="text-xl font-extrabold text-slate-900">Transaction History</h2>
                  </div>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 rounded-[14px] bg-[#635BFF] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                      <History className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-slate-700 font-semibold mb-2">No transactions yet</p>
                    <p className="text-sm text-slate-500">Recharge your wallet to see history here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#FFFDF8] border-b-[2px] border-slate-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-extrabold text-slate-900">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-extrabold text-slate-900">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-extrabold text-slate-900">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-extrabold text-slate-900">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-extrabold text-slate-900">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, index) => (
                          <motion.tr key={tx.id}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="border-b-[2px] border-slate-900/10 hover:bg-[#F9F5FF] transition-colors">
                            <td className="px-6 py-4">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${getTransactionColor(tx.type)}`}>
                                {tx.type.replace('_', ' ').toUpperCase()}
                              </div>
                            </td>
                            <td className="px-6 py-4"><p className="text-sm font-medium text-slate-900">{tx.description}</p></td>
                            <td className="px-6 py-4">
                              <span className="text-lg font-extrabold text-slate-900">
                                {['charge', 'withdrawal', 'reservation'].includes(tx.type)
                                  ? `-₹${tx.amount.toFixed(2)}`
                                  : `+₹${tx.amount.toFixed(2)}`}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                tx.status === 'completed' ? 'bg-[#4ADE80] text-white' :
                                tx.status === 'pending'   ? 'bg-[#FFE66D] text-slate-900' :
                                'bg-[#FEE2E2] text-slate-900'
                              }`}>
                                {tx.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                              {new Date(tx.createdAt).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Wallet;