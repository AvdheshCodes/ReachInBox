export type JobStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RESCHEDULED';

export interface EmailJob {
  id: string;
  scheduleId: string;
  recipient: string;
  subject: string;
  body: string;
  status: JobStatus;
  scheduledAt: string;
  sentAt?: string;
  attempts: number;
  errorMessage?: string;
  etherealUrl?: string;
  createdAt: string;
  updatedAt: string;
  schedule?: {
    subject: string;
    minDelayMs?: number;
    hourlyLimit?: number;
    sender?: {
      email: string;
      name: string;
    };
  };
}

export interface DashboardStats {
  scheduled: number;
  sent: number;
  failed: number;
  totalSchedules: number;
}

export interface UserSession {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
  };
  backendToken?: string;
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: string;
  minDelayMs: number;
  hourlyLimit: number;
}
