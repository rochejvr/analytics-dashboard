'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, LayoutDashboard, Zap, GitBranch, Users, FileText, ClipboardList, Layers, Truck, Target } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/funnels', label: 'Funnels', icon: Zap },
  { href: '/adoption', label: 'Adoption', icon: Users },
];

const appItems = [
  { href: '/apps/invoice_eval', label: 'Invoice Eval', icon: FileText, color: '#2563eb' },
  { href: '/apps/po_register', label: 'PO Register', icon: ClipboardList, color: '#7c3aed' },
  { href: '/apps/bom_analysis', label: 'BOM Analysis', icon: Layers, color: '#059669' },
  { href: '/apps/shipping', label: 'Shipping', icon: Truck, color: '#d97706' },
  { href: '/apps/kpi_board', label: 'KPI Board', icon: Target, color: '#dc2626' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-full flex flex-col border-r" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <BarChart3 size={22} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Xavant Ops</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Analytics Dashboard</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Views
        </div>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: isActive ? 'var(--accent-light)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}

        <div className="px-2 mt-5 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Apps
        </div>
        {appItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: isActive ? 'var(--accent-light)' : 'transparent',
                color: isActive ? item.color : 'var(--muted)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t text-xs" style={{ borderColor: 'var(--card-border)', color: 'var(--muted)' }}>
        Xavant Technology
      </div>
    </aside>
  );
}
