'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { EventTable } from '@/components/shared/EventTable';
import { APP_REGISTRY, DATE_RANGES, type AppId } from '@/lib/constants';
import type { ActivityEvent } from '@/types';
import { Activity, AlertTriangle, Clock, DollarSign } from 'lucide-react';

interface Summary {
  totalEvents: number;
  errorCount: number;
  appCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  avgDurationMs: number | null;
  totalCostUsd: number;
}

export default function OverviewPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const hours = DATE_RANGES.find(r => r.value === dateRange)?.hours || 168;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        fetch(`/api/events/summary?hours=${hours}`),
        fetch(`/api/events?hours=${hours}&limit=50`),
      ]);
      const summaryData = await summaryRes.json();
      const eventsData = await eventsRes.json();
      setSummary(summaryData);
      setEvents(eventsData.events || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Overview"
        subtitle="Cross-app activity and health"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchData}
        loading={loading}
      />

      <div className="flex-1 overflow-auto px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Total Events"
            value={summary?.totalEvents ?? '—'}
            subtitle={`Last ${dateRange}`}
            color="var(--accent)"
          />
          <MetricCard
            label="Errors"
            value={summary?.errorCount ?? '—'}
            subtitle={summary?.totalEvents ? `${((summary.errorCount / summary.totalEvents) * 100).toFixed(1)}% error rate` : undefined}
            color={summary?.errorCount ? 'var(--error)' : 'var(--success)'}
          />
          <MetricCard
            label="Avg Duration"
            value={summary?.avgDurationMs != null ? `${(summary.avgDurationMs / 1000).toFixed(1)}s` : '—'}
            subtitle="Performance events"
            color="var(--warning)"
          />
          <MetricCard
            label="LLM Cost"
            value={summary?.totalCostUsd != null ? `$${summary.totalCostUsd.toFixed(4)}` : '—'}
            subtitle={`Last ${dateRange}`}
            color="var(--muted)"
          />
        </div>

        {/* App Breakdown */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Activity by App</h2>
          <div className="grid grid-cols-4 gap-4">
            {(Object.keys(APP_REGISTRY) as AppId[]).map(appId => {
              const app = APP_REGISTRY[appId];
              const count = summary?.appCounts[appId] || 0;
              return (
                <div key={appId} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: count > 0 ? `${app.color}08` : 'transparent' }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: app.color }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{app.shortName}</div>
                    <div className="text-lg font-bold" style={{ color: count > 0 ? app.color : 'var(--muted)' }}>{count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        {summary?.categoryCounts && Object.keys(summary.categoryCounts).length > 0 && (
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Events by Category</h2>
            <div className="flex gap-6">
              {Object.entries(summary.categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="text-center">
                  <div className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>{count}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{cat}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Recent Events</h2>
          </div>
          <EventTable events={events} />
        </div>
      </div>
    </div>
  );
}
