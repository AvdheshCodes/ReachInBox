'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { RefreshCw, CalendarClock } from 'lucide-react';

interface ScheduledTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
}

export default function ScheduledTable({ jobs, loading, onRefresh }: ScheduledTableProps) {
  if (loading) {
    return (
      <div className="data-table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading scheduled email queue...</p>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="data-table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <CalendarClock size={28} />
          </div>
          <p className="empty-state-title">No Scheduled Emails</p>
          <p className="empty-state-desc">
            There are currently no pending or scheduled email jobs in the queue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      <div className="data-table-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="data-table-title">Scheduled Email Queue</h3>
          <span className="data-table-count">({jobs.length})</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Recipient Email</th>
              <th>Subject</th>
              <th>Scheduled Time</th>
              <th>Sender</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const statusClass =
                job.status === 'PROCESSING'
                  ? 'processing'
                  : job.status === 'RESCHEDULED'
                  ? 'rescheduled'
                  : 'scheduled';

              return (
                <tr key={job.id}>
                  <td className="table-cell-primary">{job.recipient}</td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.subject || job.schedule?.subject || '-'}
                  </td>
                  <td>{new Date(job.scheduledAt).toLocaleString()}</td>
                  <td>{job.schedule?.sender?.email || 'System Sender'}</td>
                  <td>
                    <span className={`status-badge ${statusClass}`}>{job.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
