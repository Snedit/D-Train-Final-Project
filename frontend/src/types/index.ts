export interface Job {
  _id: string;          // MongoDB uses _id
  id?: number;          // Optional for compatibility
  userId?: string;
  title: string;
  description: string;
  status: 'pending' | 'queued' | 'assigned' | 'processing' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  
  // Config
  config?: {
    entryFile?: string;
    requirementsFile?: string;
    epochs?: number;
    datasetSize?: number;
    other?: any;
  };
  
  // Files & URLs
  zipFileUrl?: string;
  modelUrl?: string;
  errorMessage?: string;
  
  // Worker assignment
  assignedWorkerId?: string;
  accepted_by?: number | null;  // For compatibility
  
  // Logs
  logs?: string[] | any[];
  
  // Legacy/compatibility fields
  name?: string;              // Alias for title
  bundle_filename?: string;
  main_entry?: string;        // Alias for config.entryFile
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
  _id: string;              // MongoDB uses _id
  id?: string;              // Add for compatibility
  deviceId: string;
  userId?: string;
  name?: string;
  
  // Status - IMPORTANT!
  status: 'online' | 'offline' | 'idle' | 'busy';
  currentStatus: 'online' | 'offline' | 'idle' | 'busy';  // ✅ Add this!
  
  // System info
  systemInfo?: {
    cpu?: string;
    gpu?: string;
    ram?: string;
    os?: string;
  };
  
  // Legacy fields for compatibility
  os?: string;
  cpu?: string;
  ram?: string;
  gpu?: string;
  
  // Timestamps
  lastHeartbeat?: number;
  lastHeartbeatAt?: Date | number;
  last_seen: string;        // Keep for compatibility
  createdAt?: string;
  updatedAt?: string;
  
  // Other
  currentJobId?: string;
  totalJobsCompleted?: number;
  walletAddress?: string;
  ratings?: number;
  token?: string;
}

export interface MetricData {
  timestamp: string;
  cpu: number;
  memory: number;
  gpu?: number;
}