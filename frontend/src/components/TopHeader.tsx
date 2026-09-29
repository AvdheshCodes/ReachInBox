'use client';

import { Search, Bell, RefreshCw } from 'lucide-react';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
}

export default function TopHeader({ title, subtitle, onRefresh }: TopHeaderProps) {
  return (
    <header className="top-header">
      <div className="top-header-left">
        <div>
          <h1 className="top-header-title">{title}</h1>
          {subtitle && <p className="top-header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="top-header-right">
        <div className="top-header-search">
          <Search className="top-header-search-icon" size={16} />
          <input type="text" placeholder="Search emails, campaigns..." />
        </div>

        {onRefresh && (
          <button className="header-icon-btn" onClick={onRefresh} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
        )}

        <button className="header-icon-btn" title="Notifications">
          <Bell size={16} />
          <span className="notification-dot"></span>
        </button>
      </div>
    </header>
  );
}
