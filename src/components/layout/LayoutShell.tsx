'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, BarChart3 } from 'lucide-react';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-12 px-4 border-b"
        style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} style={{ color: 'var(--foreground)' }} />
        </button>
        <div className="flex items-center gap-2 ml-2.5">
          <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Xavant Ops</span>
        </div>
      </div>

      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer + backdrop */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-slide-in">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content — top padding on mobile for the fixed bar */}
      <main className="flex-1 overflow-auto pt-12 lg:pt-0">
        {children}
      </main>
    </>
  );
}
