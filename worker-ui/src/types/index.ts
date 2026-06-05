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
    estimatedCost?: number;
    actualCost?: number;
    workerRate?: number;
    gpuName?: string;         // GPU used for this job
    gpuMultiplier?: number;   // Tier multiplier applied
    effectiveRate?: number;   // Actual rate after GPU adjustment
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
  };
}