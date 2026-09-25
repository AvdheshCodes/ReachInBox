import axios from 'axios';
import { SchedulePayload, EmailJob, DashboardStats } from '../types';

function getBackendUrl(): string {
  // 1. Prefer explicit env var (baked in at build time by Next.js)
  if (process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NEXT_PUBLIC_BACKEND_URL !== '') {
    return process.env.NEXT_PUBLIC_BACKEND_URL.trim();
  }
  // 2. Auto-detect: if running on Vercel (not localhost), use the deployed Render backend
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return 'https://reachinbox-backend-k55n.onrender.com';
  }
  // 3. Fallback for local development
  return 'http://localhost:5000';
}

const BACKEND_URL = getBackendUrl();

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set Authorization token dynamically
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export async function loginWithGoogleBackend(credential?: string, userInfo?: any) {
  const response = await api.post('/api/auth/google', { credential, userInfo });
  return response.data;
}

export async function fetchScheduledEmails(): Promise<EmailJob[]> {
  const response = await api.get('/api/emails/scheduled');
  return response.data.scheduled || [];
}

export async function fetchSentEmails(): Promise<EmailJob[]> {
  const response = await api.get('/api/emails/sent');
  return response.data.sent || [];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await api.get('/api/emails/stats');
  return response.data;
}

export async function submitScheduleEmails(payload: SchedulePayload) {
  const response = await api.post('/api/emails/schedule', payload);
  return response.data;
}
