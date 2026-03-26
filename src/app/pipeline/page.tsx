'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PipelineFunnel } from '@/components/shared/PipelineFunnel';
import { DATE_RANGES } from '@/lib/constants';

const PIPELINE_APPS = ['invoice_eval', 'bom_analysis'];

export default function PipelinePage() {
  const [dateRange, setDateRange] = useState('7d');
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const hours = DATE_RANGES.find(r => r.value === dateRange)?.hours || 168;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        PIPELINE_APPS.map(app =>
          fetch(`/api/events/pipeline?hours=${hours}&app=${app}`).then(r => r.json())
        )
      );
      setPipelines(results.flatMap(r => r.pipelines || []));
    } catch (err) {
      console.error('Failed to fetch pipeline data:', err);
    }
    setLoading(false);
  }, [hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Pipelines"
        subtitle="End-to-end processing funnels across apps"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={fetchData}
        loading={loading}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-5xl">
          {loading && pipelines.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Loading...</div>
          ) : pipelines.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
              No pipeline data found for this period.
            </div>
          ) : (
            pipelines.map((p: any) => <PipelineFunnel key={p.id} pipeline={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
