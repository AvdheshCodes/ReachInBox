'use client';

import React, { useState } from 'react';
import { parseEmailsFromFileContent } from '@/lib/csvParser';
import { submitScheduleEmails } from '@/lib/api';

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-300 shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center border-b border-gray-200 pb-3">
          <h2 className="text-lg font-bold text-gray-900">Compose & Schedule New Campaign</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Email Subject *</label>
            <input
              type="text"
              required
              placeholder="e.g. Scaling outreach with AI automation"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">Email Body *</label>
            <textarea
              required
              rows={4}
              placeholder="Write your email body template here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-1">
              Upload Lead List (CSV / Text File) *
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-xs text-gray-600 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
            />
            {fileName && (
              <div className="mt-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2 rounded flex justify-between">
                <span>File: {fileName}</span>
                <span className="text-emerald-700 font-bold">
                  {recipients.length} valid lead email(s) detected
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Start Schedule Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">Leave blank for immediate start</span>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">Delay Between Sends (sec)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={minDelaySec}
                onChange={(e) => setMinDelaySec(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">Inter-email throttle</span>
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">Max Emails / Hour</label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none"
              />
              <span className="text-[10px] text-gray-500">Rate limit window</span>
            </div>
          </div>

          <div className="flex justify-end space-x-3 border-t border-gray-200 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold disabled:opacity-50"
            >
              {loading ? 'Scheduling Jobs...' : `Schedule ${recipients.length} Email(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
