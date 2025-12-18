// types.ts

// ============================================
// USER TYPES
// ============================================
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'client' | 'worker' | 'admin';
  createdAt: string;
}

export interface UserProfile extends User {
  totalJobs: number;
  totalSpent: number;
}

// ============================================
// JOB TYPES
// ============================================
export interface Job {
  _id: string;
  userId: string;
  title: string;
  description: string;
  config: {
    entryFile: string;
  };
  zipFileUrl: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
  assignedWorkerId?: string; // deviceId of worker
  modelUrl?: string;
  logsUrl?: string;
  logs: JobLog[];
  createdAt: string;
  completedAt?: string;
}

export interface JobLog {
  ts: number; // timestamp
  message: string;
}

export interface JobDetail extends Job {
  worker?: Worker;
  billing?: BillingSummary;
}

// ============================================
// WORKER TYPES
// ============================================
export interface Worker {
  _id: string;
  deviceId: string; // Unique machine identifier
  os: string;
  cpu: string;
  ram: string;
  gpu?: string;
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: number; // timestamp
  currentJobId?: string;
  createdAt: string;
}

export interface WorkerStats extends Worker {
  totalJobsCompleted: number;
  totalEarnings: number;
  uptime: number; // in milliseconds
}

// ============================================
// BILLING TYPES
// ============================================
export interface Billing {
  _id: string;
  userId: string | null;
  jobId: string;
  workerId: string; // deviceId
  cpu: number; // percentage
  ram: number; // percentage
  gpu?: number; // percentage
  durationMs: number;
  amount: number; // calculated billing amount
  createdAt: string;
}

export interface BillingSummary {
  total: number;
  breakdown: Billing[];
}

// ============================================
// METRIC TYPES (for live monitoring)
// ============================================
export interface MetricData {
  timestamp: number;
  cpu: number; // percentage
  memory: number; // percentage (RAM)
  gpu?: number; // percentage
}

export interface SystemMetrics {
  jobId: string;
  workerId: string;
  metrics: MetricData[];
  averageCpu: number;
  averageMemory: number;
  averageGpu?: number;
  peakCpu: number;
  peakMemory: number;
  peakGpu?: number;
}

// ============================================
// SOCKET.IO EVENT TYPES
// ============================================
export interface SocketEvents {
  // Server → Client
  job_status: (data: { jobId: string; status: Job['status'] }) => void;
  job_log: (data: { job_id: string; line: string }) => void;
  new_job_available: (data: { jobId: string; title: string; description: string }) => void;
  worker_status: (data: { workerId: string; status: Worker['status'] }) => void;

  // Client → Server
  subscribe_job: (jobId: string) => void;
  unsubscribe_job: (jobId: string) => void;
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface RegisterResponse extends LoginResponse {}

export interface JobCreateResponse {
  message: string;
  jobId: string;
}

export interface WorkerRegisterResponse {
  message: string;
  worker: Worker;
}

export interface JobAcceptResponse {
  message: string;
  job: Job;
}

// ============================================
// ELECTRON IPC TYPES
// ============================================
export interface DeviceInfo {
  os: string;
  cpu: string;
  ram: string;
  gpu?: string;
}

export interface ElectronAPI {
  // Device Info
  getDeviceId: () => Promise<string>;
  getDeviceInfo: () => Promise<DeviceInfo>;

  // Docker Operations
  runJob: (jobConfig: {
    jobId: string;
    zipUrl: string;
    entryFile: string;
  }) => Promise<void>;
  
  stopJob: (jobId: string) => Promise<void>;

  // File Operations
  downloadFile: (url: string, destination: string) => Promise<string>;
  uploadFile: (filePath: string) => Promise<string>;

  // System Metrics
  getSystemMetrics: () => Promise<MetricData>;

  // Logs
  onJobLog: (callback: (log: string) => void) => void;
  onJobComplete: (callback: (data: { success: boolean; modelPath?: string; error?: string }) => void) => void;
}

// Extend Window interface for Electron
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// ============================================
// REDIS/QUEUE TYPES
// ============================================
export interface JobQueueMessage {
  jobId: string;
  title: string;
  description: string;
  zipFileUrl: string;
  config: {
    entryFile: string;
  };
}

// ============================================
// COMPONENT PROP TYPES
// ============================================
export interface HeroSectionProps {
  onGetStarted: () => void;
}

export interface SignInProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSwitchToSignUp?: () => void;
  onBack: () => void;
}

export interface SignUpProps {
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onSwitchToSignIn: () => void;
  onBack: () => void;
}

export interface WorkerDashboardProps {
  worker: Worker;
  onJobStart: (jobId: string) => void;
  onSignOut: () => void;
}

export interface RunningJobsProps {
  jobId: string;
  workerId: string;
  onJobComplete?: (job: Job) => void;
  onBack: () => void;
}

export interface JobDetailProps {
  job: Job;
  onBack: () => void;
}

// ============================================
// UTILITY TYPES
// ============================================
export type JobStatus = Job['status'];
export type WorkerStatus = Worker['status'];
export type UserRole = User['role'];

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface FilterOptions {
  status?: JobStatus[];
  dateFrom?: string;
  dateTo?: string;
  workerId?: string;
}

// ============================================
// LOCAL STORAGE TYPES
// ============================================
export interface StoredWorkerData {
  token: string;
  worker: Worker;
  lastSync: number;
}

export interface StoredAuthData {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  expiresAt: number;
}
