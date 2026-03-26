import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '168');
  const appId = searchParams.get('app') || 'invoice_eval';
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Fetch all relevant pipeline events
  const { data: events } = await supabase
    .from('activity_events')
    .select('event_name, duration_ms, metadata, occurred_at')
    .eq('app_id', appId)
    .in('event_name', [
      'email.received', 'invoice.evaluated', 'invoice.accepted',
      'invoice.rejected', 'invoice.duplicate', 'claim.accepted',
    ])
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true });

  if (!events || events.length === 0) {
    return NextResponse.json({ pipelines: [], period: { hours, since } });
  }

  // === Invoice Pipeline: email.received → invoice.accepted / invoice.rejected ===
  // Build a map of emailId → received timestamp
  const receivedByEmail: Record<string, string> = {};
  for (const e of events) {
    if (e.event_name === 'email.received') {
      const meta = (e.metadata || {}) as Record<string, unknown>;
      const eid = meta.emailId as string;
      if (eid) receivedByEmail[eid] = e.occurred_at;
    }
  }

  // Correlate terminal events with their email.received
  const outcomes = events.filter(e =>
    ['invoice.accepted', 'invoice.rejected', 'invoice.duplicate', 'claim.accepted'].includes(e.event_name)
  );

  type PipelineRun = {
    emailId?: string;
    invoiceType: string;
    outcome: 'accepted' | 'rejected' | 'duplicate';
    durationMs: number | null;
    occurredAt: string;
  };

  const runs: PipelineRun[] = [];
  for (const e of outcomes) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const eid = meta.emailId as string;
    const invoiceType = (meta.invoiceType as string) || 'unknown';
    const isAccepted = e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted';
    const isDuplicate = e.event_name === 'invoice.duplicate';
    const outcome = isAccepted ? 'accepted' : isDuplicate ? 'duplicate' : 'rejected';

    let durationMs: number | null = null;
    if (eid && receivedByEmail[eid]) {
      durationMs = new Date(e.occurred_at).getTime() - new Date(receivedByEmail[eid]).getTime();
    }

    runs.push({ emailId: eid, invoiceType, outcome, durationMs, occurredAt: e.occurred_at });
  }

  // Compute stats
  const acceptedRuns = runs.filter(r => r.outcome === 'accepted');
  const rejectedRuns = runs.filter(r => r.outcome === 'rejected');
  const duplicateRuns = runs.filter(r => r.outcome === 'duplicate');
  const decidedRuns = runs.filter(r => r.outcome !== 'duplicate');
  const acceptanceRate = decidedRuns.length > 0
    ? Math.round((acceptedRuns.length / decidedRuns.length) * 100)
    : 0;

  const withDuration = runs.filter(r => r.durationMs != null && r.durationMs > 0);
  const avgPipelineDurationMs = withDuration.length > 0
    ? Math.round(withDuration.reduce((sum, r) => sum + r.durationMs!, 0) / withDuration.length)
    : null;

  // By type
  type TypeStats = {
    accepted: number; rejected: number; duplicate: number; total: number;
    acceptanceRate: number; avgDurationMs: number | null;
  };
  const byType: Record<string, TypeStats> = {};
  for (const r of runs) {
    if (!byType[r.invoiceType]) {
      byType[r.invoiceType] = { accepted: 0, rejected: 0, duplicate: 0, total: 0, acceptanceRate: 0, avgDurationMs: null };
    }
    byType[r.invoiceType][r.outcome]++;
    byType[r.invoiceType].total++;
  }
  for (const [type, stats] of Object.entries(byType)) {
    const decided = stats.accepted + stats.rejected;
    stats.acceptanceRate = decided > 0 ? Math.round((stats.accepted / decided) * 100) : 0;
    const typeDurations = withDuration.filter(r => r.invoiceType === type);
    stats.avgDurationMs = typeDurations.length > 0
      ? Math.round(typeDurations.reduce((s, r) => s + r.durationMs!, 0) / typeDurations.length)
      : null;
  }

  // Pipeline stages with counts (for funnel visual)
  const emailReceivedCount = events.filter(e => e.event_name === 'email.received').length;
  const evaluatedCount = events.filter(e => e.event_name === 'invoice.evaluated').length;

  const pipeline = {
    id: 'invoice_intake',
    name: 'Invoice Intake',
    stages: [
      { name: 'Received', count: emailReceivedCount },
      { name: 'Evaluated', count: evaluatedCount },
      { name: 'Accepted', count: acceptedRuns.length },
    ],
    rejected: rejectedRuns.length,
    duplicates: duplicateRuns.length,
    acceptanceRate,
    avgDurationMs: avgPipelineDurationMs,
    byType,
    recentRuns: runs.slice(-30).reverse(),
  };

  return NextResponse.json({
    pipelines: [pipeline],
    period: { hours, since },
  });
}
