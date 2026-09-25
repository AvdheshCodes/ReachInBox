'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import ScheduledTable from '@/components/ScheduledTable';
import SentTable from '@/components/SentTable';
import ScheduleModal from '@/components/ScheduleModal';
import { fetchScheduledEmails, fetchSentEmails, fetchDashboardStats, setAuthToken, ensureAuthToken } from '@/lib/api';
import { EmailJob, DashboardStats } from '@/types';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledJobs, setScheduledJobs] = useState<EmailJob[]>([]);
  const [sentJobs, setSentJobs] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ scheduled: 0, sent: 0, failed: 0, totalSchedules: 0 });
  const [backendError, setBackendError] = useState<string | null>(null);

  const [loadingScheduled, setLoadingScheduled] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync token and check session
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (session) {
      const token = (session as any).backendToken;
      if (token) {
        setAuthToken(token);
      } else if (session.user) {
        ensureAuthToken(session.user);
      }
    }
  }, [session, status, router]);

  const loadScheduled = useCallback(async () => {
    try {
      setLoadingScheduled(true);
      const data = await fetchScheduledEmails();
      setScheduledJobs(data);
      setBackendError(null);
    } catch (err: any) {
      console.warn('Backend reachability issue:', err.message);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') ? 'https://reachinbox-backend-k55n.onrender.com' : 'http://localhost:5000');
      setBackendError(`Unable to connect to Express backend at ${backendUrl}. The backend may be starting up — please retry in a moment.`);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const loadSent = useCallback(async () => {
    try {
      setLoadingSent(true);
      const data = await fetchSentEmails();
      setSentJobs(data);
    } catch (err) {
      // Handled in loadScheduled
    } finally {
      setLoadingSent(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      // Handled in loadScheduled
    }
  }, []);

  const refreshAll = useCallback(() => {
    loadScheduled();
    loadSent();
    loadStats();
  }, [loadScheduled, loadSent, loadStats]);

  useEffect(() => {
    if (session) {
      refreshAll();
      const interval = setInterval(refreshAll, 5000);
      return () => clearInterval(interval);
    }
  }, [session, refreshAll]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mx-auto mb-2"></div>
          <p className="text-xs text-slate-600 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {backendError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs flex justify-between items-center">
            <div>
              <span className="font-bold">⚠️ Infrastructure Connection Warning: </span>
              <span>{backendError}</span>
            </div>
            <button
              onClick={refreshAll}
              className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded font-semibold text-amber-950 ml-4"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Pending / Scheduled
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{stats.scheduled}</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Successfully Sent
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.sent}</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Failed Sends
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
          </div>
          <div className="bg-white p-4 rounded border border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Total Campaigns
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalSchedules}</div>
          </div>
        </div>

        {/* Dashboard Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-200">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-200/70 p-1 rounded">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-1.5 rounded text-xs font-semibold transition ${
                activeTab === 'scheduled'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scheduled Emails ({stats.scheduled})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-1.5 rounded text-xs font-semibold transition ${
                activeTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sent Emails ({stats.sent})
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold shadow-sm flex items-center space-x-2"
          >
            <span>+</span>
            <span>Compose New Email</span>
          </button>
        </div>

        {/* Main Content Tables */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable jobs={scheduledJobs} loading={loadingScheduled} onRefresh={refreshAll} />
        ) : (
          <SentTable jobs={sentJobs} loading={loadingSent} onRefresh={refreshAll} />
        )}
      </main>

      {/* Compose Schedule Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshAll}
      />
    </div>
  );
}
