'use client';

import React, { useState, useRef } from 'react';
import { parseEmailsFromFileContent } from '@/lib/csvParser';
import { submitScheduleEmails } from '@/lib/api';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ScheduleModal({ isOpen, onClose, onSuccess }: ScheduleModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [minDelaySec, setMinDelaySec] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const emails = parseEmailsFromFileContent(content);
      setRecipients(emails);
      if (emails.length === 0) {
        setError('No valid email addresses detected in the uploaded file.');
      } else {
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setError('Email body is required.');
      return;
    }
    if (recipients.length === 0) {
      setError('Please upload a CSV or text file containing at least one valid recipient email.');
      return;
    }

    const startDateTime = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();
    const delayMs = Math.max(0, parseFloat(minDelaySec) * 1000);
    const limit = Math.max(1, parseInt(hourlyLimit, 10));

    try {
      setLoading(true);
      await submitScheduleEmails({
        subject,
        body,
        recipients,
        scheduledAt: startDateTime,
        minDelayMs: delayMs,
        hourlyLimit: limit,
      });

      setLoading(false);
      onSuccess();
      onClose();
      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      setFileName('');
      setScheduledAt('');
    } catch (err: any) {
      setLoading(false);
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Compose & Schedule Campaign</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Subject */}
            <div className="form-group">
              <label className="form-label">Email Subject *</label>
              <input
                type="text"
                required
                placeholder="e.g. Scaling outreach with AI automation"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Body */}
            <div className="form-group">
              <label className="form-label">Email Body *</label>
              <textarea
                required
                rows={4}
                placeholder="Write your email body template here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="form-textarea"
              />
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label className="form-label">Lead List (CSV / Text) *</label>
              <div
                className="file-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Upload size={24} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                <p className="file-upload-label">
                  Click to upload or drag & drop your CSV / text file
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports .csv and .txt files
                </p>
              </div>

              {fileName && (
                <div className="file-upload-info">
                  <span className="file-upload-info-name">
                    <FileText size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    {fileName}
                  </span>
                  <span className="file-upload-info-count">
                    <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {recipients.length} leads detected
                  </span>
                </div>
              )}
            </div>

            {/* Schedule Options Grid */}
            <div className="form-grid" style={{ marginTop: '8px' }}>
              <div className="form-group">
                <label className="form-label">Schedule Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="form-input"
                />
                <span className="form-hint">Blank = immediate</span>
              </div>

              <div className="form-group">
                <label className="form-label">Delay (sec)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={minDelaySec}
                  onChange={(e) => setMinDelaySec(e.target.value)}
                  className="form-input"
                />
                <span className="form-hint">Inter-email throttle</span>
              </div>

              <div className="form-group">
                <label className="form-label">Max Emails/Hour</label>
                <input
                  type="number"
                  min="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(e.target.value)}
                  className="form-input"
                />
                <span className="form-hint">Rate limit window</span>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ padding: '16px 0 0', margin: '16px 0 0', borderTop: '1px solid var(--border-primary)' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary">
                {loading ? (
                  <>
                    <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                    Scheduling...
                  </>
                ) : (
                  `Schedule ${recipients.length} Email(s)`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
