import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, ArrowLeft, CreditCard, History, TrendingUp, AlertCircle } from 'lucide-react';

interface Transaction {
    _id: string;
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

declare global {
    interface Window {
        Razorpay: any;
    }
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

    useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        try {
            const token = localStorage.getItem('dtrain_token');

            // Fetch balance
            const balanceRes = await fetch(`${API_BASE}/wallet/balance`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (balanceRes.ok) {
                const balanceData = await balanceRes.json();
                setBalance(balanceData.balance);
            }

            // Fetch transactions
            const transactionsRes = await fetch(`${API_BASE}/wallet/transactions?limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (transactionsRes.ok) {
                const transactionsData = await transactionsRes.json();
                setTransactions(transactionsData.transactions);
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
            const orderRes = await fetch(`${API_BASE}/wallet/topup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ amount: rechargeAmount })
            });

            if (!orderRes.ok) {
                const errorData = await orderRes.json();
                throw new Error(errorData.message || 'Failed to create order');
            }

            const orderData = await orderRes.json();

            // Step 2: Open Razorpay checkout
            const options = {
                key: RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'DTrain Platform',
                description: 'Wallet Recharge',
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    await verifyPayment(response);
                },
                prefill: {
                    name: 'User',
                    email: 'user@example.com'
                },
                theme: {
                    color: '#60A5FA'
                },
                modal: {
                    ondismiss: function () {
                        setProcessing(false);
                        setError('Payment cancelled');
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (err: any) {
            setError(err.message || 'Failed to initiate payment');
            setProcessing(false);
        }
    };

    const verifyPayment = async (response: any) => {
        try {
            const token = localStorage.getItem('dtrain_token');

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

            if (!verifyRes.ok) {
                throw new Error('Payment verification failed');
            }

            const data = await verifyRes.json();
            setBalance(data.newBalance);
            setSuccess(`✅ Successfully recharged ₹${parseFloat(amount).toFixed(2)}!`);
            setAmount('100');
            setProcessing(false);

            // Refresh transactions
            fetchWalletData();
        } catch (err: any) {
            setError(err.message || 'Payment verification failed');
            setProcessing(false);
        }
    };

    const getTransactionColor = (type: string) => {
        switch (type) {
            case 'topup': return 'bg-[#7CF2D0] text-slate-900';
            case 'charge': return 'bg-[#FEE2E2] text-slate-900';
            case 'refund': return 'bg-[#FFE66D] text-slate-900';
            case 'reservation': return 'bg-[#FFB4D3] text-slate-900';
            default: return 'bg-gray-100 text-slate-900';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-[#4ADE80] text-slate-900';
            case 'pending': return 'bg-[#FFE66D] text-slate-900';
            case 'failed': return 'bg-[#FEE2E2] text-slate-900';
            default: return 'bg-gray-100 text-slate-900';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFEFE1] flex items-center justify-center">
                <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 rounded-[16px] border-[4px] border-slate-900 bg-blue-400 shadow-[6px_6px_0_0_rgba(15,23,42,1)]"
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
                {/* Header */}
                <div className="mb-8">
                    <motion.button
                        whileHover={{ x: -4 }}
                        whileTap={{ x: 0 }}
                        onClick={onBack}
                        className="flex items-center gap-2 px-4 py-2 rounded-[12px] border-[3px] border-slate-900 bg-white text-slate-900 font-bold shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] mb-6"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </motion.button>

                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-[14px] bg-[#A8E6CF] border-[3px] border-slate-900 flex items-center justify-center shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                            <WalletIcon className="w-6 h-6 text-slate-900" />
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900">My Wallet</h1>
                    </div>
                    <p className="text-slate-700 font-medium">Manage your wallet and view transaction history</p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#FEE2E2] shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <p className="font-bold text-red-600">{error}</p>
                        </div>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-[16px] border-[3px] border-slate-900 bg-[#7CF2D0] shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                    >
                        <p className="font-bold text-slate-900">{success}</p>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Balance Card */}
                    <div className="lg:col-span-1">
                        <div className="rounded-[22px] border-[3px] border-slate-900 bg-gradient-to-br from-[#A8E6CF] to-[#7CF2D0] p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-slate-900" />
                                <p className="text-sm font-bold text-slate-900">Current Balance</p>
                            </div>
                            <p className="text-5xl font-extrabold text-slate-900 mb-2">₹{balance.toFixed(2)}</p>
                            <p className="text-xs font-semibold text-slate-700">Available for jobs</p>
                        </div>
                    </div>

                    {/* Recharge Card */}
                    <div className="lg:col-span-2">
                        <div className="rounded-[22px] border-[3px] border-slate-900 bg-white p-8 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
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
                                        className={`px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold shadow-[3px_3px_0_0_rgba(15,23,42,1)] transition-all ${amount === quickAmount.toString()
                                                ? 'bg-blue-400 text-white'
                                                : 'bg-white text-slate-900 hover:bg-blue-50'
                                            }`}
                                    >
                                        ₹{quickAmount}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Custom Amount Input */}
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-900 mb-2">
                                    Custom Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="10"
                                    className="w-full px-4 py-3 rounded-[12px] border-[3px] border-slate-900 font-bold text-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] focus:outline-none focus:shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all"
                                    placeholder="Enter amount (min ₹10)"
                                />
                            </div>

                            {/* Recharge Button */}
                            <motion.button
                                whileHover={{ y: -2 }}
                                whileTap={{ y: 0 }}
                                onClick={handleRecharge}
                                disabled={processing}
                                className="w-full px-6 py-4 rounded-[14px] border-[3px] border-slate-900 bg-blue-400 text-white text-lg font-extrabold shadow-[6px_6px_0_0_rgba(15,23,42,1)] transition-all hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? 'Processing...' : '💳 Recharge Now'}
                            </motion.button>

                            <p className="text-xs text-slate-600 font-medium mt-4 text-center">
                                🧪 Test Card: 4111 1111 1111 1111 | CVV: 123 | OTP: 123456
                            </p>
                        </div>
                    </div>
                </div>

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
                            <p className="text-slate-700 font-semibold">No transactions yet</p>
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
                                            key={transaction._id}
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
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                                {transaction.description}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-extrabold text-slate-900">
                                                {transaction.type === 'charge' || transaction.type === 'reservation' ? '-' : '+'}₹{transaction.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`inline-flex items-center px-3 py-1 rounded-full border-[2px] border-slate-900 text-xs font-bold shadow-[2px_2px_0_0_rgba(15,23,42,1)] ${getStatusColor(transaction.status)}`}>
                                                    {transaction.status.toUpperCase()}
                                                </div>
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
    );
};

export default Wallet;
