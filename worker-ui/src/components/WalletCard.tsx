import React from 'react';

import { Wallet, TrendingUp, Clock, History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import type { Transaction } from '../types';



interface WalletCardProps {
    balance: number;
    totalEarnings: number;
    pendingEarnings: number;
    transactions?: Transaction[];
    onWithdraw?: () => void;
}

const WalletCard: React.FC<WalletCardProps> = ({
    balance,
    totalEarnings,
    pendingEarnings,
    transactions = [],
    // onWithdraw,
}) => {
    return (
        <div className="rounded-[22px] border-[3px] border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden mb-8">
            <div className="p-6 bg-gradient-to-r from-blue-100 to-indigo-50 border-b-[3px] border-slate-900">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                            <Wallet className="w-6 h-6" />
                            My Wallet
                        </h2>
                        <p className="text-slate-600 text-sm font-medium">Manage your earnings and withdrawals</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-white rounded-[14px] border-[2px] border-slate-900 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Available Balance</p>
                            <p className="text-2xl font-black text-slate-900">₹{balance.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {/* Stats */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-[16px] bg-[#DCFCE7] border-[3px] border-slate-900">
                        <div className="flex items-start justify-between mb-2">
                            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-700" />
                            </div>
                            <span className="px-2 py-1 rounded-full bg-white/50 text-xs font-bold text-green-800">Lifetime</span>
                        </div>
                        <p className="text-sm font-bold text-green-800 mb-1">Total Earnings</p>
                        <p className="text-2xl font-black text-slate-900">₹{totalEarnings.toFixed(2)}</p>
                    </div>

                    <div className="p-4 rounded-[16px] bg-[#FEF3C7] border-[3px] border-slate-900">
                        <div className="flex items-start justify-between mb-2">
                            <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-700" />
                            </div>
                            <span className="px-2 py-1 rounded-full bg-white/50 text-xs font-bold text-amber-800">Pending</span>
                        </div>
                        <p className="text-sm font-bold text-amber-800 mb-1">In Progress</p>
                        <p className="text-2xl font-black text-slate-900">₹{pendingEarnings.toFixed(2)}</p>
                    </div>
                </div>

                {/* Actions - Placeholder for now */}
                <div className="flex flex-col justify-center gap-3 p-4 rounded-[16px] bg-slate-50 border-[3px] border-slate-200 border-dashed">
                    <button
                        disabled
                        className="w-full py-3 px-4 rounded-[12px] bg-slate-200 text-slate-400 font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                        <ArrowUpRight className="w-4 h-4" />
                        Withdraw Funds
                    </button>
                    <p className="text-xs text-center text-slate-400 font-medium">Withdrawals coming soon</p>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="border-t-[3px] border-slate-900">
                <div className="px-6 py-3 bg-slate-50 border-b-[2px] border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Recent Transactions
                    </h3>
                    <button className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline">
                        View All
                    </button>
                </div>

                <div className="divide-y-2 divide-slate-100 max-h-[250px] overflow-y-auto">
                    {transactions.length > 0 ? (
                        transactions.map((tx) => (
                            <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center border-[2px] border-slate-900 ${tx.type === 'worker_payout' || tx.type === 'topup'
                                        ? 'bg-[#DCFCE7] text-green-700'
                                        : 'bg-[#FEE2E2] text-red-700'
                                        }`}>
                                        {tx.type === 'worker_payout' || tx.type === 'topup' ? (
                                            <ArrowDownLeft className="w-5 h-5" />
                                        ) : (
                                            <ArrowUpRight className="w-5 h-5" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900">{tx.description}</p>
                                        <p className="text-xs font-semibold text-slate-500">
                                            {new Date(tx.createdAt).toLocaleDateString()} • {new Date(tx.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <div className={`text-right font-black ${tx.type === 'worker_payout' || tx.type === 'topup'
                                    ? 'text-green-600'
                                    : 'text-slate-900'
                                    }`}>
                                    {tx.type === 'worker_payout' || tx.type === 'topup' ? '+' : '-'}
                                    ₹{tx.amount.toFixed(2)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-6 py-8 text-center text-slate-500 font-medium">
                            No transactions yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalletCard;
