'use client';

import { DATE_RANGES } from '@/lib/constants';
import { RefreshCw } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function PageHeader({ title, subtitle, dateRange, onDateRangeChange, onRefresh, loading }: PageHeaderProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b"
      style={{ borderColor: 'var(--card-border)' }}
    >
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: 'var(--foreground)' }}>{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {/* Date range pills */}
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
          {DATE_RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => onDateRangeChange(r.value)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: dateRange === r.value ? 'var(--accent)' : 'var(--card)',
                color: dateRange === r.value ? '#fff' : 'var(--muted)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--card-border)', color: 'var(--muted)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>
    </div>
  );
}
