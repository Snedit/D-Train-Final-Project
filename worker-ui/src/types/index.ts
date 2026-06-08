export interface Pricing {
  hourlyRate: number;
  minimumCharge: number;
  currency: string;
}

export interface Wallet {
  balance: number;
  totalEarnings: number;
  pendingEarnings: number;
}

export interface Transaction {
  id: string;
  type: 'topup' | 'reservation' | 'charge' | 'refund' | 'withdrawal' | 'worker_payout';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  jobTitle?: string;
  createdAt: string;
}

export interface Worker {
  _id: string;
  deviceId: string;
  os: string;
  cpu: string;
  ram: string;
  gpu: string;
  status: string;
  currentStatus: string;
  lastHeartbeatAt?: number;
  createdAt: string;
  pricing?: Pricing;
  walletBalance?: number;
  totalEarnings?: number;
  pendingEarnings?: number;
  totalJobsCompleted?: number;
  stripeAccountId?: string | null;  // Stripe Connect account for bank payouts
}

export interface Job {
  _id: string;
  userId: string;
  title: string;
  description: string;
  status: string;
  zipFileUrl: string;
  config: {
    entryFile: string;
    requirementsFile: string;
    epochs?: number;
    datasetSize?: number;
  };
  assignedWorkerId?: string;
  logs: string[];
  modelUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  pricing?: {
    tierPrice?: number;       // Groq-assigned flat fee
    workerPay?: number;       // 80% of tierPrice
    platformFee?: number;     // 20% of tierPrice
    actualCost?: number;      // Set on completion (= tierPrice)
    gpuName?: string;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
  };
}