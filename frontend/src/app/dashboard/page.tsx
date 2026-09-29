'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import TopHeader from '@/components/TopHeader';
import ScheduledTable from '@/components/ScheduledTable';
import SentTable from '@/components/SentTable';
import ScheduleModal from '@/components/ScheduleModal';
import { fetchScheduledEmails, fetchSentEmails, fetchDashboardStats, setAuthToken, ensureAuthToken } from '@/lib/api';
import { EmailJob, DashboardStats } from '@/types';
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Layers,
  Plus,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

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
      <div className="page-loader">
        <div className="page-loader-inner">
          <div className="loading-spinner" style={{ margin: '0 auto 12px' }}></div>
          <p className="loading-text">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const statCards = [
    {
      label: 'Pending / Scheduled',
      value: stats.scheduled,
      icon: CalendarClock,
      colorClass: 'blue',
      cardClass: 'stat-scheduled',
    },
    {
      label: 'Successfully Sent',
      value: stats.sent,
      icon: CheckCircle2,
      colorClass: 'green',
      cardClass: 'stat-sent',
    },
    {
      label: 'Failed Sends',
      value: stats.failed,
      icon: XCircle,
      colorClass: 'red',
      cardClass: 'stat-failed',
    },
    {
      label: 'Total Campaigns',
      value: stats.totalSchedules,
      icon: Layers,
      colorClass: 'purple',
      cardClass: 'stat-campaigns',
    },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} stats={stats} />

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <TopHeader
          title="Email Dashboard"
          subtitle="Monitor and manage your email campaigns"
          onRefresh={refreshAll}
        />

        {/* Page Content */}
        <div className="page-content">
          {/* Backend Error Alert */}
          {backendError && (
            <div className="alert-banner warning">
              <div className="alert-banner-text">
                <strong>
                  <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Infrastructure Warning:{' '}
                </strong>
                {backendError}
              </div>
              <button className="btn btn-sm btn-secondary" onClick={refreshAll}>
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          )}

          {/* Stats Grid */}
          <div className="stats-grid">
            {statCards.map((card) => (
              <div key={card.label} className={`stat-card ${card.cardClass}`}>
                <div className="stat-card-header">
                  <span className="stat-card-label">{card.label}</span>
                  <div className={`stat-card-icon ${card.colorClass}`}>
                    <card.icon size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{card.value}</div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div className="action-bar">
            <div className="tab-group">
              <button
                className={`tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
                onClick={() => setActiveTab('scheduled')}
              >
                Scheduled ({stats.scheduled})
              </button>
              <button
                className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                onClick={() => setActiveTab('sent')}
              >
                Sent ({stats.sent})
              </button>
            </div>

            <div className="action-bar-right">
              <button className="btn btn-secondary btn-sm" onClick={refreshAll}>
                <RefreshCw size={14} />
                Refresh
              </button>
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={16} />
                Compose New Email
              </button>
            </div>
          </div>

          {/* Data Tables */}
          {activeTab === 'scheduled' ? (
            <ScheduledTable jobs={scheduledJobs} loading={loadingScheduled} onRefresh={refreshAll} />
          ) : (
            <SentTable jobs={sentJobs} loading={loadingSent} onRefresh={refreshAll} />
          )}
        </div>
      </div>

      {/* Compose Schedule Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshAll}
      />
    </div>
  );
}
