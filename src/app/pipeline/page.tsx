'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { DATE_RANGES } from '@/lib/constants';
import { format, isToday } from 'date-fns';
import { CheckCircle, XCircle, Copy, Clock, TrendingUp } from 'lucide-react';

interface TypeStats {
  accepted: number;
  rejected: number;
  total: number;
  acceptanceRate: number;
  avgDurationMs: number | null;
}

interface PipelineData {
  totals: {
    accepted: number;
    rejected: number;
    duplicate: number;
    total: number;
    acceptanceRate: number;
  };
  byType: Record<string, TypeStats>;
  processingTimes: {
    overall: number | null;
    byType: Record<string, number>;
  };
  recentEvents: Array<{
    event_name: string;
    duration_ms: number | null;
    metadata: Record<string, unknown>;
    occurred_at: string;
  }>;
}

const TYPE_COLORS: Record<string, string> = {
  general: '#2563eb',
  courier: '#d97706',
  claim: '#7c3aed',
  unknown: '#94a3b8',
};

const TYPE_LABELS: Record<string, string> = {
  general: 'General',
  courier: 'Courier',
  claim: 'Claims',
  unknown: 'Unknown',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
}

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr);
  const time = format(d, 'HH:mm:ss');
  if (isToday(d)) return `Today ${time}`;
  return format(d, 'MMM dd') + ' ' + time;
}

export default function PipelinePage() {
  const [dateRange, setDateRange] = useState('7d');
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);

  const hours = DATE_RANGES.find(r => r.value === dateRange)?.hours || 168;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/pipeline?hours=${hours}`);
      setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const types = data ? Object.entries(data.byType).sort((a, b) => b[1].total - a[1].total) : [];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Invoice Pipeline"
        subtitle="Processing time and first-pass acceptance rate"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchData}
        loading={loading}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
          {loading && !data ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Loading...</div>
          ) : !data || data.totals.total === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
              No invoice events found for this period. Process some invoices via email to see data here.
            </div>
          ) : (
            <>
              {/* Top metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <MetricCard
                  label="First-Pass Acceptance"
                  value={`${data.totals.acceptanceRate}%`}
                  subtitle={`${data.totals.accepted} of ${data.totals.total} invoices`}
                  color={data.totals.acceptanceRate >= 80 ? 'var(--success)' : data.totals.acceptanceRate >= 50 ? 'var(--warning)' : 'var(--error)'}
                />
                <MetricCard
                  label="Avg Processing Time"
                  value={data.processingTimes.overall ? formatDuration(data.processingTimes.overall) : '—'}
                  subtitle="Email to acceptance"
                />
                <MetricCard
                  label="Accepted"
                  value={data.totals.accepted}
                  color="var(--success)"
                />
                <MetricCard
                  label="Rejected"
                  value={data.totals.rejected}
                  color="var(--error)"
                />
                <MetricCard
                  label="Duplicates"
                  value={data.totals.duplicate}
                  subtitle="Skipped"
                  color="var(--muted)"
                />
              </div>

              {/* By type breakdown */}
              {types.length > 0 && (
                <div
                  className="rounded-xl border"
                  style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
                >
                  <div className="px-4 sm:px-5 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      By Invoice Type
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                          <th className="text-left px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Type</th>
                          <th className="text-right px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Total</th>
                          <th className="text-right px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Accepted</th>
                          <th className="text-right px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Rejected</th>
                          <th className="text-right px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Acceptance %</th>
                          <th className="text-right px-4 sm:px-5 py-3 font-medium" style={{ color: 'var(--muted)' }}>Avg Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {types.map(([type, stats]) => (
                          <tr key={type} className="border-b last:border-b-0" style={{ borderColor: 'var(--card-border)' }}>
                            <td className="px-4 sm:px-5 py-3">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[type] || TYPE_COLORS.unknown }} />
                                <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                                  {TYPE_LABELS[type] || type}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-right font-mono" style={{ color: 'var(--foreground)' }}>
                              {stats.total}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-right font-mono" style={{ color: 'var(--success)' }}>
                              {stats.accepted}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-right font-mono" style={{ color: 'var(--error)' }}>
                              {stats.rejected}
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-right">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="inline-block w-12 h-1.5 rounded-full overflow-hidden"
                                  style={{ background: 'var(--card-border)' }}
                                >
                                  <span
                                    className="block h-full rounded-full"
                                    style={{
                                      width: `${stats.acceptanceRate}%`,
                                      background: stats.acceptanceRate >= 80 ? 'var(--success)' : stats.acceptanceRate >= 50 ? 'var(--warning)' : 'var(--error)',
                                    }}
                                  />
                                </span>
                                <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>
                                  {stats.acceptanceRate}%
                                </span>
                              </span>
                            </td>
                            <td className="px-4 sm:px-5 py-3 text-right font-mono text-xs" style={{ color: 'var(--muted)' }}>
                              {stats.avgDurationMs ? formatDuration(stats.avgDurationMs) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent events */}
              <div
                className="rounded-xl border"
                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
              >
                <div className="px-4 sm:px-5 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Recent Invoice Events
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Time</th>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Result</th>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Type</th>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Supplier</th>
                        <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Invoice #</th>
                        <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--muted)' }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentEvents.map((event, i) => {
                        const meta = event.metadata || {};
                        const isAccepted = event.event_name === 'invoice.accepted' || event.event_name === 'claim.accepted';
                        const isDuplicate = event.event_name === 'invoice.duplicate';
                        const invoiceType = (meta.invoiceType as string) || 'unknown';
                        return (
                          <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50/50" style={{ borderColor: 'var(--card-border)' }}>
                            <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                              {formatEventTime(event.occurred_at)}
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                {isAccepted && <><CheckCircle size={13} style={{ color: 'var(--success)' }} /><span style={{ color: 'var(--success)' }}>Accepted</span></>}
                                {event.event_name === 'invoice.rejected' && <><XCircle size={13} style={{ color: 'var(--error)' }} /><span style={{ color: 'var(--error)' }}>Rejected</span></>}
                                {isDuplicate && <><Copy size={13} style={{ color: 'var(--muted)' }} /><span style={{ color: 'var(--muted)' }}>Duplicate</span></>}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[invoiceType] || TYPE_COLORS.unknown }} />
                                {TYPE_LABELS[invoiceType] || invoiceType}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs" style={{ color: 'var(--foreground)' }}>
                              {(meta.supplierName as string) || '—'}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>
                              {(meta.invoiceNumber as string) || '—'}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: 'var(--muted)' }}>
                              {event.duration_ms ? formatDuration(event.duration_ms) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
