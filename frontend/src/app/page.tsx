'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push('/dashboard');
    }
  }, [session, router]);

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 shadow-sm rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-block bg-slate-900 text-white font-bold text-xl px-4 py-1.5 rounded mb-3">
            ReachInbox
          </div>
          <h1 className="text-xl font-bold text-gray-900">Email Job Scheduler Ops</h1>
          <p className="text-xs text-gray-500 mt-1">
            Production-grade outreach email queue and scheduling service dashboard.
          </p>
        </div>

        {status === 'loading' && (
          <div className="mb-4 text-center text-xs text-slate-500 flex items-center justify-center space-x-2 bg-slate-50 py-1.5 rounded border border-slate-200">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-900 border-t-transparent"></div>
            <span>Checking active session...</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 border border-gray-300 rounded shadow-sm bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google OAuth</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-400 font-semibold">Or Quick Demo Login</span>
            </div>
          </div>

          <button
            onClick={() =>
              signIn('demo-login', {
                email: 'admin@reachinbox.ai',
                name: 'Outreach Admin',
                callbackUrl: '/dashboard',
              })
            }
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition"
          >
            Enter Dashboard (Instant Demo Login)
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 text-center text-[11px] text-gray-400">
          ReachInbox Hiring Assignment &bull; Full-stack Email Job Scheduler
        </div>
      </div>
    </main>
  );
}
