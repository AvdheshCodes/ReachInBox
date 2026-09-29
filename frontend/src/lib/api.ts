import axios from 'axios';
import { SchedulePayload, EmailJob, DashboardStats } from '../types';

function getBackendUrl(): string {
  // 1. Prefer explicit env var (baked in at build time by Next.js)
  if (process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NEXT_PUBLIC_BACKEND_URL !== '') {
    return process.env.NEXT_PUBLIC_BACKEND_URL.trim();
  }
  // 2. Server-side detection: VERCEL env var is always set on Vercel serverless functions
  if (process.env.VERCEL === '1') {
    return 'https://reachinbox-backend-k55n.onrender.com';
  }
  // 3. Client-side detection: check if running on a non-localhost domain
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return 'https://reachinbox-backend-k55n.onrender.com';
  }
  // 4. Fallback for local development
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('reachinbox_backend_token', token);
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('reachinbox_backend_token');
    }
  }
}

// Request interceptor to automatically attach token or generate dev token
api.interceptors.request.use(async (config) => {
  if (!config.headers['Authorization']) {
    let cachedToken: string | null = null;
    if (typeof window !== 'undefined') {
      cachedToken = localStorage.getItem('reachinbox_backend_token');
    }
    
    if (cachedToken) {
      config.headers['Authorization'] = `Bearer ${cachedToken}`;
      api.defaults.headers.common['Authorization'] = `Bearer ${cachedToken}`;
    } else if (config.url !== '/api/auth/google') {
      try {
        // Auto-authenticate as default user for seamless local development
        const response = await axios.post(`${BACKEND_URL}/api/auth/google`, {
          userInfo: {
            email: 'user@reachinbox.ai',
            name: 'Outreach Manager',
          },
        });
        if (response.data?.token) {
          const token = response.data.token;
          config.headers['Authorization'] = `Bearer ${token}`;
          setAuthToken(token);
        }
      } catch (err) {
        console.warn('[API] Auto-auth failed:', err);
      }
    }
  }
  return config;
}, (error) => Promise.reject(error));

export async function ensureAuthToken(user?: any): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('reachinbox_backend_token');
    if (cached) {
      setAuthToken(cached);
      return cached;
    }
  }
  try {
    const userInfo = user && user.email ? user : { email: 'user@reachinbox.ai', name: 'Outreach Manager' };
    const res = await loginWithGoogleBackend(undefined, userInfo);
    if (res?.token) {
      setAuthToken(res.token);
      return res.token;
    }
  } catch (err) {
    console.error('[API] Failed to auto-generate backend token:', err);
  }
  return null;
}

export async function loginWithGoogleBackend(credential?: string, userInfo?: any) {
  const response = await api.post('/api/auth/google', { credential, userInfo });
  if (response.data?.token) {
    setAuthToken(response.data.token);
  }
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
