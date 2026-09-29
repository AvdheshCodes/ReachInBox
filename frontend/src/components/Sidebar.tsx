'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Mail,
  Send,
  CalendarClock,
  Users,
  Settings,
  LogOut,
  Bell,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  activeTab?: 'scheduled' | 'sent';
  onTabChange?: (tab: 'scheduled' | 'sent') => void;
  stats?: { scheduled: number; sent: number; failed: number; totalSchedules: number };
}

export default function Sidebar({ activeTab, onTabChange, stats }: SidebarProps) {
  const { data: session } = useSession();
  const user = session?.user;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: true,
      onClick: undefined as (() => void) | undefined,
    },
    {
      id: 'scheduled',
      label: 'Scheduled Emails',
      icon: CalendarClock,
      active: false,
      selected: activeTab === 'scheduled',
      badge: stats?.scheduled,
      onClick: () => onTabChange?.('scheduled'),
    },
    {
      id: 'sent',
      label: 'Sent Emails',
      icon: Send,
      active: false,
      selected: activeTab === 'sent',
      badge: stats?.sent,
      onClick: () => onTabChange?.('sent'),
    },
  ];

  const secondaryItems = [
    {
      id: 'campaigns',
      label: 'Campaigns',
      icon: Mail,
      badge: stats?.totalSchedules,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      id: 'leads',
      label: 'Lead Lists',
      icon: Users,
    },
  ];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">R</div>
        <div>
          <div className="sidebar-logo-text">ReachInbox</div>
          <div className="sidebar-logo-badge">Scheduler</div>
        </div>
      </div>

      {/* Primary Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Main</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${item.active ? 'active' : ''}`}
              onClick={item.onClick}
            >
              <item.icon className="sidebar-nav-icon" size={20} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Secondary Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Management</div>
        <nav className="sidebar-nav">
          {secondaryItems.map((item) => (
            <button key={item.id} className="sidebar-nav-item">
              <item.icon className="sidebar-nav-icon" size={20} />
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">System</div>
        <nav className="sidebar-nav">
          <button className="sidebar-nav-item">
            <Bell className="sidebar-nav-icon" size={20} />
            <span>Notifications</span>
          </button>
          <button className="sidebar-nav-item">
            <Settings className="sidebar-nav-icon" size={20} />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* User Footer */}
      <div className="sidebar-footer">
        {user && (
          <>
            <div className="sidebar-user">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name || 'User'}
                  className="sidebar-user-avatar"
                />
              ) : (
                <div className="sidebar-user-avatar-placeholder">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name || 'User'}</div>
                <div className="sidebar-user-email">{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="logout-btn"
              style={{ marginTop: '8px' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
