'use client';

import React, { useState } from 'react';
import { EmailJob } from '@/types';
import { RefreshCw, CalendarClock, Trash2, AlertTriangle, X } from 'lucide-react';
import { deleteScheduledEmail, deleteScheduledEmailsBatch } from '@/lib/api';

interface ScheduledTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
}

export default function ScheduledTable({ jobs, loading, onRefresh }: ScheduledTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'batch';
    jobId?: string;
    jobRecipient?: string;
  }>({ isOpen: false, type: 'single' });

  const allSelected = jobs.length > 0 && selectedIds.length === jobs.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(jobs.map((j) => j.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const triggerSingleDelete = (id: string, recipient: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      jobId: id,
      jobRecipient: recipient,
    });
  };

  const triggerBatchDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'batch',
    });
  };

  const executeDelete = async () => {
    if (confirmModal.type === 'single' && confirmModal.jobId) {
      try {
        setDeletingId(confirmModal.jobId);
        await deleteScheduledEmail(confirmModal.jobId);
        setSelectedIds((prev) => prev.filter((id) => id !== confirmModal.jobId));
        setConfirmModal({ isOpen: false, type: 'single' });
        onRefresh();
      } catch (err: any) {
        alert(err?.response?.data?.error || err.message || 'Failed to delete scheduled email');
      } finally {
        setDeletingId(null);
      }
    } else if (confirmModal.type === 'batch' && selectedIds.length > 0) {
      try {
        setIsDeletingBatch(true);
        await deleteScheduledEmailsBatch(selectedIds);
        setSelectedIds([]);
        setConfirmModal({ isOpen: false, type: 'batch' });
        onRefresh();
      } catch (err: any) {
        alert(err?.response?.data?.error || err.message || 'Failed to delete scheduled emails');
      } finally {
        setIsDeletingBatch(false);
      }
    }
  };

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
      {/* Header */}
      <div className="data-table-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h3 className="data-table-title">Scheduled Email Queue</h3>
          <span className="data-table-count">({jobs.length})</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="table-batch-bar">
          <div className="table-batch-info">
            <AlertTriangle size={16} />
            <span>{selectedIds.length} email(s) selected</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
              Cancel Selection
            </button>
            <button className="btn btn-danger btn-sm" onClick={triggerBatchDelete}>
              <Trash2 size={14} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  title="Select All"
                />
              </th>
              <th>Recipient Email</th>
              <th>Subject</th>
              <th>Scheduled Time</th>
              <th>Sender</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
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
              const isSelected = selectedIds.includes(job.id);
              const isDeletingThis = deletingId === job.id;

              return (
                <tr
                  key={job.id}
                  style={isSelected ? { background: 'rgba(99, 102, 241, 0.06)' } : undefined}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(job.id)}
                    />
                  </td>
                  <td className="table-cell-primary">{job.recipient}</td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.subject || job.schedule?.subject || '-'}
                  </td>
                  <td>{new Date(job.scheduledAt).toLocaleString()}</td>
                  <td>{job.schedule?.sender?.email || 'System Sender'}</td>
                  <td>
                    <span className={`status-badge ${statusClass}`}>{job.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="table-action-btn"
                      onClick={() => triggerSingleDelete(job.id, job.recipient)}
                      disabled={isDeletingThis}
                      title="Delete scheduled email"
                    >
                      {isDeletingThis ? (
                        <div
                          className="loading-spinner"
                          style={{ width: '12px', height: '12px', borderWidth: '2px' }}
                        ></div>
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ isOpen: false, type: 'single' })}>
          <div
            className="modal-container"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--accent-red-subtle)',
                    color: 'var(--accent-red)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={18} />
                </div>
                <h2 className="modal-title" style={{ fontSize: '16px' }}>
                  {confirmModal.type === 'single'
                    ? 'Delete Scheduled Email?'
                    : `Delete ${selectedIds.length} Scheduled Email(s)?`}
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setConfirmModal({ isOpen: false, type: 'single' })}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {confirmModal.type === 'single' ? (
                  <>
                    Are you sure you want to delete the scheduled email for{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.jobRecipient}</strong>?
                    This will remove it from the send queue immediately.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{selectedIds.length}</strong> selected scheduled email(s)?
                    They will be permanently cancelled and removed from the queue.
                  </>
                )}
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmModal({ isOpen: false, type: 'single' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={deletingId !== null || isDeletingBatch}
                onClick={executeDelete}
              >
                {deletingId !== null || isDeletingBatch ? (
                  <>
                    <div
                      className="loading-spinner"
                      style={{ width: '12px', height: '12px', borderWidth: '2px' }}
                    ></div>
                    Deleting...
                  </>
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

