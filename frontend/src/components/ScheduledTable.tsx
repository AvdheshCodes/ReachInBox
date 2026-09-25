'use client';

import React from 'react';
import { EmailJob } from '@/types';

interface ScheduledTableProps {
  jobs: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
}

export default function ScheduledTable({ jobs, loading, onRefresh }: ScheduledTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded border border-gray-200 p-8 text-center text-gray-500 text-xs">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-900 border-t-transparent mb-2"></div>
        <p>Loading scheduled email queue...</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded border border-gray-200 p-12 text-center text-gray-500">
        <div className="text-3xl mb-2">📬</div>
        <p className="font-semibold text-gray-800 text-sm">No Scheduled Emails</p>
        <p className="text-xs text-gray-500 mt-1">There are currently no pending or scheduled email jobs.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-gray-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Scheduled Email Queue ({jobs.length})
        </h3>
        <button
          onClick={onRefresh}
          className="text-xs text-slate-600 hover:text-slate-900 font-medium underline"
        >
          Refresh Queue
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700 border-b border-gray-200 font-semibold">
              <th className="py-2.5 px-4">Recipient Email</th>
              <th className="py-2.5 px-4">Subject</th>
              <th className="py-2.5 px-4">Scheduled Time</th>
              <th className="py-2.5 px-4">Sender</th>
              <th className="py-2.5 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="py-2.5 px-4 font-mono font-medium text-gray-900">{job.recipient}</td>
                <td className="py-2.5 px-4 text-gray-800 truncate max-w-xs">
                  {job.subject || job.schedule?.subject || '-'}
                </td>
                <td className="py-2.5 px-4 text-gray-600">
                  {new Date(job.scheduledAt).toLocaleString()}
                </td>
                <td className="py-2.5 px-4 text-gray-600">
                  {job.schedule?.sender?.email || 'System Sender'}
                </td>
                <td className="py-2.5 px-4">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                      job.status === 'PROCESSING'
                        ? 'bg-amber-100 text-amber-800'
                        : job.status === 'RESCHEDULED'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {job.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
