'use client';

import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

export default function Navbar() {
  const { data: session } = useSession();

  const user = session?.user;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 text-white font-bold text-lg px-3 py-1 rounded">
              ReachInbox
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Email Scheduler Ops
            </span>
          </div>

          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 text-right">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || 'User Avatar'}
                    className="w-9 h-9 rounded-full border border-gray-300 object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-gray-900">{user.name || 'User'}</div>
                  <div className="text-gray-500">{user.email}</div>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
