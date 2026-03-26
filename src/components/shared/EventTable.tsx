'use client';

import type { ActivityEvent } from '@/types';
import { format, isToday } from 'date-fns';
import { APP_REGISTRY, type AppId } from '@/lib/constants';

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  const time = format(d, 'HH:mm:ss');
  if (isToday(d)) return `Today ${time}`;
  return format(d, 'MMM dd') + ' ' + time;
}

interface EventTableProps {
  events: ActivityEvent[];
  showApp?: boolean;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  user_action: { bg: 'var(--accent-light)', text: 'var(--accent)' },
  system: { bg: '#f1f5f9', text: '#475569' },
  pipeline: { bg: 'var(--success-light)', text: 'var(--success)' },
  error: { bg: 'var(--error-light)', text: 'var(--error)' },
  performance: { bg: 'var(--warning-light)', text: 'var(--warning)' },
};

export function EventTable({ events, showApp = true }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
        No events found for this time range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Time</th>
            {showApp && <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>App</th>}
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Category</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Event</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Actor</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {events.map(event => {
            const cat = categoryColors[event.category] || categoryColors.system;
            const app = APP_REGISTRY[event.app_id as AppId];
            return (
              <tr key={event.id} className="border-b hover:bg-gray-50/50" style={{ borderColor: 'var(--card-border)' }}>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {formatEventTime(event.occurred_at)}
                </td>
                {showApp && (
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ background: app?.color || '#94a3b8' }} />
                      {app?.shortName || event.app_id}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: cat.bg, color: cat.text }}
                  >
                    {event.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--foreground)' }}>
                  {event.event_name}
                </td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                  {event.actor_email || event.actor_id || '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: 'var(--muted)' }}>
                  {event.duration_ms != null ? `${event.duration_ms}ms` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
