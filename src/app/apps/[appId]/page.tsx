'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { EventTable } from '@/components/shared/EventTable';
import { PipelineFunnel } from '@/components/shared/PipelineFunnel';
import { APP_REGISTRY, DATE_RANGES, type AppId } from '@/lib/constants';
import type { ActivityEvent } from '@/types';

// Apps that have pipeline funnels
const PIPELINE_APPS = ['invoice_eval', 'bom_analysis'];

export default function AppDetailPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const app = APP_REGISTRY[appId as AppId];
  const [dateRange, setDateRange] = useState('7d');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [pipelines, setPipelines] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const hours = DATE_RANGES.find(r => r.value === dateRange)?.hours || 168;
  const hasPipelines = PIPELINE_APPS.includes(appId);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetches: Promise<Response>[] = [
        fetch(`/api/events?hours=${hours}&app=${appId}&limit=100`),
      ];
      if (hasPipelines) {
        fetches.push(fetch(`/api/events/pipeline?hours=${hours}&app=${appId}`));
      }
      const responses = await Promise.all(fetches);
      const eventsData = await responses[0].json();
      setEvents(eventsData.events || []);

      if (hasPipelines && responses[1]) {
        const pipelineData = await responses[1].json();
        setPipelines(pipelineData.pipelines || []);
      }
    } catch (err) {
      console.error('Failed to fetch app events:', err);
    }
    setLoading(false);
  }, [hours, appId, hasPipelines]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const errorCount = events.filter(e => e.category === 'error').length;
  const perfEvents = events.filter(e => e.category === 'performance' && e.duration_ms != null);
  const avgDuration = perfEvents.length > 0
    ? Math.round(perfEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / perfEvents.length)
    : null;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={app?.name || appId}
        subtitle={app?.description}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchData}
        loading={loading}
      />

      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard label="Events" value={events.length} subtitle={`Last ${dateRange}`} color={app?.color} />
          <MetricCard label="Errors" value={errorCount} color={errorCount > 0 ? 'var(--error)' : 'var(--success)'} />
          <MetricCard
            label="Avg Duration"
            value={avgDuration != null ? `${(avgDuration / 1000).toFixed(1)}s` : '—'}
            subtitle="Per event"
            color="var(--warning)"
          />
          <MetricCard
            label="Unique Actors"
            value={new Set(events.map(e => e.actor_email || e.actor_id).filter(Boolean)).size}
            color="var(--muted)"
          />
        </div>

        {/* Pipeline funnels */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {pipelines.map((p: any) => (
          <PipelineFunnel key={p.id} pipeline={p} />
        ))}

        <div
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Event Log</h2>
          </div>
          <EventTable events={events} showApp={false} />
        </div>
      </div>
    </div>
  );
}
