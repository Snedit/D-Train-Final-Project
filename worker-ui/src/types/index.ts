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
  status: string;
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
  lastHeartbeat: number;
  createdAt: string;
  pricing?: Pricing;
  walletBalance?: number;
  totalEarnings?: number;
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
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
  };
}
