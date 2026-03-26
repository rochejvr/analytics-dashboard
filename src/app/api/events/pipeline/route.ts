import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '168');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Fetch accepted, rejected, duplicate, and claim events
  const { data: events } = await supabase
    .from('activity_events')
    .select('event_name, duration_ms, metadata, occurred_at')
    .eq('app_id', 'invoice_eval')
    .in('event_name', ['invoice.accepted', 'invoice.rejected', 'invoice.duplicate', 'claim.accepted'])
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false });

  if (!events || events.length === 0) {
    return NextResponse.json({
      totals: { accepted: 0, rejected: 0, duplicate: 0, total: 0, acceptanceRate: 0 },
      byType: {},
      processingTimes: { overall: null, byType: {} },
      recentEvents: [],
      period: { hours, since },
    });
  }

  // Categorize
  const accepted = events.filter(e => e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted');
  const rejected = events.filter(e => e.event_name === 'invoice.rejected');
  const duplicate = events.filter(e => e.event_name === 'invoice.duplicate');
  const total = accepted.length + rejected.length;
  const acceptanceRate = total > 0 ? Math.round((accepted.length / total) * 100) : 0;

  // By invoice type
  type TypeStats = { accepted: number; rejected: number; total: number; acceptanceRate: number; avgDurationMs: number | null };
  const byType: Record<string, TypeStats> = {};

  for (const e of events) {
    if (e.event_name === 'invoice.duplicate') continue;
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const invoiceType = (meta.invoiceType as string) || 'unknown';
    if (!byType[invoiceType]) {
      byType[invoiceType] = { accepted: 0, rejected: 0, total: 0, acceptanceRate: 0, avgDurationMs: null };
    }
    if (e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted') {
      byType[invoiceType].accepted++;
    } else if (e.event_name === 'invoice.rejected') {
      byType[invoiceType].rejected++;
    }
    byType[invoiceType].total++;
  }

  // Acceptance rate per type
  for (const stats of Object.values(byType)) {
    stats.acceptanceRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
  }

  // Processing times (from events that have duration_ms)
  const withDuration = events.filter(e => e.duration_ms != null && e.event_name !== 'invoice.duplicate');
  const overallAvg = withDuration.length > 0
    ? Math.round(withDuration.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / withDuration.length)
    : null;

  const durationByType: Record<string, number[]> = {};
  for (const e of withDuration) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const invoiceType = (meta.invoiceType as string) || 'unknown';
    if (!durationByType[invoiceType]) durationByType[invoiceType] = [];
    durationByType[invoiceType].push(e.duration_ms || 0);
  }

  const avgByType: Record<string, number> = {};
  for (const [type, durations] of Object.entries(durationByType)) {
    avgByType[type] = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    if (byType[type]) byType[type].avgDurationMs = avgByType[type];
  }

  return NextResponse.json({
    totals: {
      accepted: accepted.length,
      rejected: rejected.length,
      duplicate: duplicate.length,
      total,
      acceptanceRate,
    },
    byType,
    processingTimes: {
      overall: overallAvg,
      byType: avgByType,
    },
    recentEvents: events.slice(0, 50),
    period: { hours, since },
  });
}
