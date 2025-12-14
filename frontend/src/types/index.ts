export interface Job {
  id: number;
  name: string;
  status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string | null;
  bundle_filename: string;
  main_entry: string;
  requirements_file: string;
  accepted_by: number | null;
  docker_image_tag: string;
}

export interface JobLog {
  id: number;
  job_id: number;
  message: string;
  level: string;
  ts: string;
}

export interface Worker {
  id: number;
  name: string;
  status: string;
  last_seen: string;
  token?: string;
}

export interface MetricData {
  timestamp: string;
  cpu: number;
  memory: number;
  gpu?: number;
}