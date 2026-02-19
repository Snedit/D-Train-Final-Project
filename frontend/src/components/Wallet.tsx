import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, ArrowLeft, CreditCard, History, TrendingUp } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'topup' | 'reservation' | 'charge' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

interface WalletProps {
  onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ onBack }) => {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('100');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const RAZORPAY_KEY_ID = 'rzp_test_SEkIf7zpx0v0Lc';
  const API_BASE = 'http://localhost:5000/api/payment';

  const getTransactionColor = (type: Transaction['type']) => {
    const colors: Record<string, string> = {
      topup: 'bg-[#7CF2D0] text-slate-900',
      reservation: 'bg-[#FFE66D] text-slate-900',
      charge: 'bg-[#FEE2E2] text-slate-900',
      refund: 'bg-[#4ADE80] text-slate-900'
    };
    return colors[type] || 'bg-slate-200 text-slate-900';
  };

  const fetchWalletData = async () => {
    try {
      const token = localStorage.getItem('dtrain_token');

      const balanceRes = await fetch(`${API_BASE}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        setBalance(balanceData.balance);
      }

      const transactionsRes = await fetch(`${API_BASE}/wallet/transactions?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData.transactions || []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching wallet data:', err);
      setError('Failed to load wallet data');
      setLoading(false);
    }
  };

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
      const token = localStorage.getItem('dtrain_token');

      // Step 1: Create Razorpay order
      // Send plain rupee amount — backend handles conversion to paise for Razorpay
      const orderRes = await fetch(`${API_BASE}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: rechargeAmount })
      });

      const orderData = await orderRes.json();

      // Backend returns "orderId", not "id"
      if (!orderData.orderId) {
        throw new Error(orderData.message || 'Order creation failed');
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.amount,       // paise value returned by backend/Razorpay
        currency: orderData.currency,
        order_id: orderData.orderId,    // ✅ matches backend response field
        name: 'DTrain Wallet',
        description: `Recharge ₹${rechargeAmount}`,
        handler: async (response: any) => {
          // Step 3: Verify payment — correct endpoint is /razorpay/verify
          const verifyRes = await fetch(`${API_BASE}/razorpay/verify`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyData.newBalance !== undefined) {
            setSuccess(`Recharged ₹${rechargeAmount} successfully!`);
            fetchWalletData();
          } else {
            setError(verifyData.message || 'Payment verification failed');
          }
        },
        prefill: {
          name: 'DTrain User',
          email: localStorage.getItem('dtrain_user')
            ? JSON.parse(localStorage.getItem('dtrain_user')!).email
            : 'user@example.com'
        },
        theme: { color: '#1e293b' }
      };

      // @ts-ignore
      const rzp = new (window as any).Razorpay(options);

      rzp.on('payment.failed', (response: any) => {
        console.error('Razorpay payment failed:', response.error);
        setError(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (err: any) {
      console.error('Recharge error:', err);
      setError(err.message || 'Recharge failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-[#60A5FA] shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-4 rounded-full border-[4px] border-slate-900 bg-[#FFD447]"
            />
          </div>
          <p className="text-lg font-extrabold text-slate-900">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#FFEFE1] px-4 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -4 }}
          whileTap={{ x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Back to Dashboard
        </motion.button>

        {/* Outer Brutalist Frame */}
        <div className="relative">
          {/* Grid Background */}
          <div
            className="absolute inset-0 rounded-[32px] border-[3px] border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] bg-[#FFFDF8]"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
              backgroundSize: '26px 26px'
            }}
          />

          {/* Memphis Decorative Shapes */}
          <motion.div
            className="absolute -top-8 -left-8 w-24 h-24 rounded-full border-[3px] border-slate-900 bg-[#FFD447] flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <TrendingUp className="w-8 h-8 text-slate-900" />
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -right-6 w-32 h-16 rounded-[999px] border-[3px] border-slate-900 bg-[#7CF2D0]"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="absolute top-12 -right-10 w-24 h-24 rounded-[20px] border-[3px] border-slate-900 bg-[#A8E6CF] flex items-center justify-center"
            animate={{ rotate: [6, -6, 6] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <WalletIcon className="w-8 h-8 text-slate-900" />
          </motion.div>

          {/* Main Content */}
          <div className="relative z-10 px-6 py-7 md:px-10 md:py-9">
            {/* Balance & Recharge Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Balance Card */}
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ y: 0 }}
                className="lg:col-span-1 rounded-[22px] border-[3px] border-slate-900 bg-gradient-to-br from-[#A8E6CF] to-[#7CF2D0] p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-slate-900" />
                  <p className="text-sm font-bold text-slate-900">Current Balance</p>
                </div>
                <p className="text-5xl font-extrabold text-slate-900 mb-2">₹{balance.toFixed(2)}</p>
                <p className="text-xs font-semibold text-slate-700">Available for jobs</p>
              </motion.div>

              {/* Recharge Card */}
              <div className="lg:col-span-2 rounded-[22px] border-[3px] border-slate-900 bg-white p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                <div className="flex items-center gap-2 mb-6">
                  <CreditCard className="w-5 h-5 text-slate-900" />
                  <h2 className="text-xl font-extrabold text-slate-900">Recharge Wallet</h2>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[50, 100, 500, 1000].map((quickAmount) => (
                    <motion.button
                      key={quickAmount}
                      whileHover={{ y: -2 }}
                      whileTap={{ y: 0 }}
                      onClick={() => setAmount(quickAmount.toString())}
                      className={`px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all ${
                        amount === quickAmount.toString()
                          ? 'bg-[#60A5FA] text-white'
                          : 'bg-white text-slate-900 hover:bg-[#EFF6FF]'
                      }`}
                    >
                      ₹{quickAmount}
                    </motion.button>
                  ))}
                </div>

                {/* Custom Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-900 mb-2">Custom Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="10"
                    className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] focus:outline-none focus:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all placeholder:text-slate-500"
                    placeholder="Enter amount (min ₹10)"
                  />
                </div>

                {/* Recharge Button */}
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  onClick={handleRecharge}
                  disabled={processing}
                  className="w-full px-6 py-4 rounded-[14px] border-[3px] border-slate-900 bg-[#60A5FA] text-white text-lg font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] hover:bg-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-[3px] border-white border-t-transparent rounded-full mr-2 inline-block"
                      />
                      Processing...
                    </>
                  ) : (
                    'Recharge Now'
                  )}
                </motion.button>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#FEE2E2] shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
              >
                <span className="font-bold text-slate-900">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#7CF2D0] shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
              >
                <span className="font-bold text-slate-900">{success}</span>
              </motion.div>
            )}

            {/* Transaction History Table */}
            <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
              <div className="p-6 border-b-[3px] border-slate-900 bg-[#F5F3FF]">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-900" />
                  <h2 className="text-xl font-extrabold text-slate-900">Transaction History</h2>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-[14px] bg-[#60A5FA] border-[3px] border-slate-900 flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
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
                      {transactions.map((transaction, index) => (
                        <motion.tr
                          key={transaction.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="border-b-[2px] border-slate-900/10 hover:bg-[#F9F5FF] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${getTransactionColor(transaction.type)}`}>
                              {transaction.type.toUpperCase()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-900">{transaction.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-lg font-extrabold text-slate-900">
                              {transaction.type === 'charge'
                                ? `-₹${transaction.amount.toFixed(2)}`
                                : `+₹${transaction.amount.toFixed(2)}`}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              transaction.status === 'completed' ? 'bg-[#4ADE80] text-white' :
                              transaction.status === 'pending' ? 'bg-[#FFE66D] text-slate-900' :
                              'bg-[#FEE2E2] text-slate-900'
                            }`}>
                              {transaction.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                            {new Date(transaction.createdAt).toLocaleString()}
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
  );
};

export default Wallet;