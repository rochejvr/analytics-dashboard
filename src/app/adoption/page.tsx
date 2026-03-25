'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { APP_REGISTRY, DATE_RANGES, type AppId } from '@/lib/constants';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { getEventDescription } from '@/lib/event-registry';

interface FeatureEntry {
  event: string;
  count: number;
}

interface TopFeature {
  event: string;
  app: string;
  count: number;
}

interface AdoptionData {
  totalEvents: number;
  uniqueActors: number;
  actorCountsByApp: Record<string, number>;
  trendPct: number;
  appTotals: Record<string, number>;
  featuresByApp: Record<string, FeatureEntry[]>;
  topFeatures: TopFeature[];
  dailyUsage: Record<string, unknown>[];
  period: { hours: number; since: string };
}

export default function AdoptionPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [data, setData] = useState<AdoptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const hours = DATE_RANGES.find(r => r.value === dateRange)?.hours || 168;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/adoption?hours=${hours}`);
      const json = await res.json();
      setData(json);
      // Auto-expand apps that have data
      if (json.featuresByApp) {
        setExpandedApps(new Set(Object.keys(json.featuresByApp)));
      }
    } catch (err) {
      console.error('Failed to fetch adoption data:', err);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleApp = (appId: string) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  // Get all app IDs that appear in daily data (for chart areas)
  const activeAppIds = useMemo(() => {
    if (!data?.appTotals) return [];
    return (Object.keys(APP_REGISTRY) as AppId[]).filter(id => (data.appTotals[id] || 0) > 0);
  }, [data]);

  // Compute events per day average
  const eventsPerDay = useMemo(() => {
    if (!data?.dailyUsage || data.dailyUsage.length === 0) return 0;
    return Math.round(data.totalEvents / data.dailyUsage.length);
  }, [data]);

  // Find the top app
  const topApp = useMemo(() => {
    if (!data?.appTotals) return null;
    const entries = Object.entries(data.appTotals);
    if (entries.length === 0) return null;
    const [appId, count] = entries.sort((a, b) => b[1] - a[1])[0];
    const app = APP_REGISTRY[appId as AppId];
    return app ? { name: app.shortName, count, color: app.color } : null;
  }, [data]);

  // Unique features count
  const uniqueFeatures = useMemo(() => {
    if (!data?.featuresByApp) return 0;
    return Object.values(data.featuresByApp).reduce((sum, arr) => sum + arr.length, 0);
  }, [data]);

  // Format date labels for chart
  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Adoption"
        subtitle="Feature usage and engagement across apps"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchData}
        loading={loading}
      />

      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            label="Active Features"
            value={uniqueFeatures || '—'}
            subtitle={`Distinct events in ${dateRange}`}
            color="var(--accent)"
          />
          <MetricCard
            label="Unique Users"
            value={data?.uniqueActors ?? '—'}
            subtitle={`Last ${dateRange}`}
            color="var(--success)"
          />
          <MetricCard
            label="Events / Day"
            value={eventsPerDay || '—'}
            subtitle="Average over period"
            color="var(--warning)"
          />
          <MetricCard
            label="Trend"
            value={data ? `${data.trendPct >= 0 ? '+' : ''}${data.trendPct}%` : '—'}
            subtitle="2nd half vs 1st half of period"
            color={data && data.trendPct > 0 ? 'var(--success)' : data && data.trendPct < 0 ? 'var(--error)' : 'var(--muted)'}
          />
        </div>

        {/* Usage over time chart */}
        {data?.dailyUsage && data.dailyUsage.length > 0 && activeAppIds.length > 0 && (
          <div
            className="rounded-xl border p-5"
            style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Usage Over Time
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyUsage} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--card-border)' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    labelFormatter={(label) => formatDate(String(label))}
                    formatter={(value, name) => {
                      const app = APP_REGISTRY[String(name) as AppId];
                      return [String(value), app?.shortName || String(name)];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const app = APP_REGISTRY[value as AppId];
                      return <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{app?.shortName || value}</span>;
                    }}
                  />
                  {activeAppIds.map(appId => {
                    const app = APP_REGISTRY[appId];
                    return (
                      <Area
                        key={appId}
                        type="monotone"
                        dataKey={appId}
                        stackId="1"
                        stroke={app.color}
                        fill={app.color}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Two-column layout: Top Features + Users by App */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Top features table */}
          {data?.topFeatures && data.topFeatures.length > 0 && (
            <div
              className="rounded-xl border"
              style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
            >
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Top Features
                </h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                    <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>#</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>Feature</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>App</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium" style={{ color: 'var(--muted)' }}>Count</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium w-32" style={{ color: 'var(--muted)' }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topFeatures.map((f, i) => {
                    const app = APP_REGISTRY[f.app as AppId];
                    const pct = data.totalEvents > 0 ? (f.count / data.totalEvents) * 100 : 0;
                    const desc = getEventDescription(f.app, f.event);
                    return (
                      <tr key={`${f.app}-${f.event}`} className="border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                        <td className="px-5 py-2.5 font-mono text-xs align-top" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                        <td className="px-5 py-2.5">
                          <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>{f.event}</span>
                          {desc && <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</div>}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: app?.color || 'var(--muted)' }} />
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>{app?.shortName || f.app}</span>
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono font-medium" style={{ color: 'var(--foreground)' }}>{f.count}</td>
                        <td className="px-5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%`, background: app?.color || 'var(--accent)' }}
                              />
                            </div>
                            <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--muted)' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Users by App */}
          <div className="space-y-4">
            <div
              className="rounded-xl border p-5"
              style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                Users by App
              </h2>
              <div className="space-y-3">
                {(Object.keys(APP_REGISTRY) as AppId[]).map(appId => {
                  const app = APP_REGISTRY[appId];
                  const users = data?.actorCountsByApp[appId] || 0;
                  const events = data?.appTotals[appId] || 0;
                  if (events === 0) return null;
                  return (
                    <div key={appId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: app.color }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{app.shortName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          <Users size={11} className="inline mr-1" />{users}
                        </span>
                        <span className="text-xs font-mono" style={{ color: app.color }}>
                          {events} events
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Most active app highlight */}
            {topApp && (
              <div
                className="rounded-xl border p-5"
                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
              >
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Most Active App</div>
                <div className="text-xl font-bold" style={{ color: topApp.color }}>{topApp.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{topApp.count} events in {dateRange}</div>
              </div>
            )}
          </div>
        </div>

        {/* Feature breakdown by app — collapsible sections */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Feature Breakdown by App
            </h2>
          </div>
          {(Object.keys(APP_REGISTRY) as AppId[]).map(appId => {
            const app = APP_REGISTRY[appId];
            const features = data?.featuresByApp[appId];
            if (!features || features.length === 0) return null;

            const isExpanded = expandedApps.has(appId);
            const totalForApp = features.reduce((s, f) => s + f.count, 0);

            return (
              <div key={appId} className="border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                <button
                  onClick={() => toggleApp(appId)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded
                      ? <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
                      : <ChevronRight size={14} style={{ color: 'var(--muted)' }} />
                    }
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: app.color }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{app.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${app.color}15`, color: app.color }}>
                      {features.length} features
                    </span>
                  </div>
                  <span className="text-sm font-mono font-medium" style={{ color: app.color }}>{totalForApp}</span>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-3">
                    <div className="space-y-2 ml-8">
                      {features.map(f => {
                        const pct = totalForApp > 0 ? (f.count / totalForApp) * 100 : 0;
                        const desc = getEventDescription(appId, f.event);
                        return (
                          <div key={f.event}>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                                {f.event}
                              </span>
                              <div className="w-24 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: 'var(--card-border)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(pct, 100)}%`, background: app.color, opacity: 0.6 }}
                                />
                              </div>
                              <span className="text-xs font-mono w-8 text-right shrink-0" style={{ color: 'var(--muted)' }}>
                                {f.count}
                              </span>
                            </div>
                            {desc && (
                              <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {data && Object.keys(data.featuresByApp).length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No feature events recorded in this period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
