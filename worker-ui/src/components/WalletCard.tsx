import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, TrendingUp, Clock, History, ArrowUpRight, ArrowDownLeft, X, Banknote } from 'lucide-react';
import type { Transaction } from '../types';

interface WalletCardProps {
  balance: number;
  totalEarnings: number;
  pendingEarnings: number;
  transactions?: Transaction[];
  hasStripeAccount?: boolean;
  onRequestPayout?: () => void;
  onClose?: () => void;
}

const WalletCard: React.FC<WalletCardProps> = ({
  balance,
  totalEarnings,
  pendingEarnings,
  transactions = [],
  hasStripeAccount = false,
  onRequestPayout,
  onClose,
}) => {
  const canPayout = balance >= 50;

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-[24px] border-[3px] border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 bg-[#FFD447] border-b-[3px] border-slate-900 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Wallet className="w-6 h-6" />
          My Wallet
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-900" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[14px] border-[3px] border-slate-900 bg-[#FFD447] p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest mb-1">Balance</p>
            <p className="text-2xl font-extrabold text-slate-900 leading-none">₹{balance.toFixed(2)}</p>
            <p className="text-[10px] font-semibold text-slate-600 mt-1">Available</p>
          </div>

          <div className="rounded-[14px] border-[3px] border-slate-900 bg-[#7CF2D0] p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Earned</p>
              <TrendingUp className="w-3.5 h-3.5 text-slate-700" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 leading-none">₹{totalEarnings.toFixed(2)}</p>
            <p className="text-[10px] font-semibold text-slate-600 mt-1">Lifetime</p>
          </div>

          <div className="rounded-[14px] border-[3px] border-slate-900 bg-[#7BC8FF] p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-widest">Pending</p>
              <Clock className="w-3.5 h-3.5 text-slate-700" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 leading-none">₹{pendingEarnings.toFixed(2)}</p>
            <p className="text-[10px] font-semibold text-slate-600 mt-1">In progress</p>
          </div>
        </div>

        {/* Payout / Withdraw Button */}
        <motion.button
          whileHover={canPayout ? { y: -2 } : {}}
          whileTap={canPayout ? { y: 0 } : {}}
          onClick={canPayout ? onRequestPayout : undefined}
          disabled={!canPayout}
          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-[14px] border-[3px] border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all font-bold text-sm ${
            canPayout
              ? 'bg-[#7CF2D0] text-slate-900 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)] cursor-pointer'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border-dashed border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Banknote className={`w-4 h-4 ${canPayout ? 'text-slate-900' : 'text-slate-400'}`} />
            <span>Withdraw Funds</span>
          </div>
          <div className="flex items-center gap-2">
            {!hasStripeAccount && canPayout && (
              <span className="px-2 py-0.5 rounded-full border border-slate-400 bg-white text-[9px] font-extrabold text-slate-500">
                Manual
              </span>
            )}
            {hasStripeAccount && canPayout && (
              <span className="px-2 py-0.5 rounded-full border border-[#635BFF] bg-[#EEF2FF] text-[9px] font-extrabold text-[#635BFF]">
                Instant
              </span>
            )}
            {!canPayout && (
              <span className="text-[10px] text-slate-400 font-semibold">Min ₹50</span>
            )}
            <ArrowUpRight className={`w-4 h-4 ${canPayout ? 'text-slate-900' : 'text-slate-400'}`} />
          </div>
        </motion.button>

        {/* Transaction History */}
        <div className="rounded-[14px] border-[3px] border-slate-900 overflow-hidden shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <div className="flex items-center justify-between px-5 py-3 bg-[#F5F3FF] border-b-[3px] border-slate-900">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4" />
              Recent Transactions
            </h3>
            <span className="px-2 py-0.5 rounded-full border-[2px] border-slate-900 bg-white text-[10px] font-extrabold text-slate-700">
              {transactions.length} total
            </span>
          </div>

          <div className="divide-y-[2px] divide-slate-100 max-h-[240px] overflow-y-auto bg-white">
            {transactions.length > 0 ? (
              transactions.map((tx, index) => {
                const isCredit = tx.type === 'worker_payout' || tx.type === 'topup';
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-[8px] border-[2px] border-slate-900 flex items-center justify-center shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex-shrink-0 ${
                        isCredit ? 'bg-[#7CF2D0]' : tx.type === 'withdrawal' ? 'bg-[#FDE68A]' : 'bg-[#FFB4D3]'
                      }`}>
                        {isCredit
                          ? <ArrowDownLeft className="w-4 h-4 text-slate-900" />
                          : <ArrowUpRight className="w-4 h-4 text-slate-900" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight">{tx.description}</p>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          {new Date(tx.createdAt).toLocaleDateString()} · {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`text-sm font-extrabold ${isCredit ? 'text-green-600' : 'text-slate-900'}`}>
                        {isCredit ? '+' : '-'}₹{tx.amount.toFixed(2)}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                        tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-10 h-10 rounded-[10px] bg-[#FFD447] border-[2px] border-slate-900 flex items-center justify-center mb-2 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
                  <History className="w-5 h-5 text-slate-900" />
                </div>
                <p className="text-sm font-bold text-slate-700">No transactions yet</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Complete jobs to see earnings here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletCard;