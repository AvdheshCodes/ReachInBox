'use client';

import React from 'react';
import { EmailJob } from '@/types';
import { RefreshCw, Send, ExternalLink } from 'lucide-react';

interface SentTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
}

export default function SentTable({ jobs, loading, onRefresh }: SentTableProps) {
  if (loading) {
    return (
      <div className="data-table-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading sent email logs...</p>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="data-table-container">
        <div className="empty-state">
          <div className="empty-state-icon">
            <Send size={28} />
          </div>
          <p className="empty-state-title">No Sent Emails</p>
          <p className="empty-state-desc">
            No emails have been processed or dispatched yet. Schedule your first campaign to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table-container">
      <div className="data-table-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="data-table-title">Sent Email History</h3>
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
              <th>Sent Time</th>
              <th>Status</th>
              <th>Preview / Details</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const statusClass = job.status === 'SENT' ? 'sent' : 'failed';

              return (
                <tr key={job.id}>
                  <td className="table-cell-primary">{job.recipient}</td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.subject || job.schedule?.subject || '-'}
                  </td>
                  <td>{job.sentAt ? new Date(job.sentAt).toLocaleString() : '-'}</td>
                  <td>
                    <span className={`status-badge ${statusClass}`}>{job.status}</span>
                  </td>
                  <td>
                    {job.etherealUrl ? (
                      <a
                        href={job.etherealUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--accent-indigo)', fontWeight: 500 }}
                      >
                        <ExternalLink size={12} />
                        View Mail Preview
                      </a>
                    ) : job.errorMessage ? (
                      <span className="error-text" title={job.errorMessage}>
                        Error: {job.errorMessage}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
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
