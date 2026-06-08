export interface Job {
  _id: string;
  id?: number;
  userId?: string;
  title: string;
  description: string;
  status: 'draft' | 'pending' | 'queued' | 'assigned' | 'processing' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;

  config?: {
    entryFile?: string;
    requirementsFile?: string;
    epochs?: number;
    datasetSize?: number;
    other?: any;
  };

  zipFileUrl?: string;
  modelUrl?: string;
  errorMessage?: string;

  assignedWorkerId?: string;
  accepted_by?: number | null;

  logs?: string[] | any[];

  pricing?: {
    estimatedCost?: number;
    actualCost?: number;
    workerRate?: number;
    gpuName?: string;
    gpuMultiplier?: number;
    effectiveRate?: number;
    startTime?: string;
    endTime?: string;
    durationSeconds?: number;
  };

  // Legacy/compatibility fields
  name?: string;
  bundle_filename?: string;
  main_entry?: string;
  requirements_file?: string;
  docker_image_tag?: string;
}

export interface JobLog {
  id?: number;
  job_id?: number;
  message: string;
  level: string;
  ts?: string;
  timestamp?: string;
}

export interface Worker {
  _id: string;
  id?: string;
  deviceId: string;
  userId?: string;
  name?: string;

  // ✅ Single source of truth — currentStatus matches MongoDB schema
  currentStatus: 'online' | 'offline' | 'idle' | 'busy';
  // ✅ Keep status as alias for compatibility with any legacy code
  status?: 'online' | 'offline' | 'idle' | 'busy';

  systemInfo?: {
    cpu?: string;
    gpu?: string;
    ram?: string;
    os?: string;
  };

  // Legacy flat fields for compatibility
  os?: string;
  cpu?: string;
  ram?: string;
  gpu?: string;

  // ✅ FIX: Accept string | number | Date so getTimeAgo works without casting
  lastHeartbeatAt?: string | number | Date;
  lastHeartbeat?: string | number | Date;
  last_seen?: string;   // ✅ Made optional — not in MongoDB schema

  createdAt?: string;
  updatedAt?: string;

  currentJobId?: string;
  totalJobsCompleted?: number;
  walletAddress?: string;
  ratings?: number;
  token?: string;

  // Earnings / pricing
  totalEarnings?: number;
  pendingEarnings?: number;
  walletBalance?: number;
  pricing?: {
    hourlyRate?: number;
    minimumCharge?: number;
    currency?: string;
  };
}

export interface MetricData {
  timestamp: string;
  cpu: number;
  memory: number;
  gpu?: number;
}