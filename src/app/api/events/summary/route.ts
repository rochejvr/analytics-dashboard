import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '168');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Get counts by app
  const { data: byApp } = await supabase
    .from('activity_events')
    .select('app_id, category')
    .gte('occurred_at', since);

  // Get error count
  const errorCount = byApp?.filter(e => e.category === 'error').length || 0;

  // Count by app
  const appCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  for (const event of byApp || []) {
    appCounts[event.app_id] = (appCounts[event.app_id] || 0) + 1;
    categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
  }

  // Get events with duration for avg duration calc
  const { data: timedEvents } = await supabase
    .from('activity_events')
    .select('duration_ms')
    .gte('occurred_at', since)
    .not('duration_ms', 'is', null);

  const avgDuration = timedEvents && timedEvents.length > 0
    ? Math.round(timedEvents.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / timedEvents.length)
    : null;

  // Get LLM cost from any event that recorded a USD value
  const { data: costEvents } = await supabase
    .from('activity_events')
    .select('value_numeric')
    .gte('occurred_at', since)
    .eq('value_currency', 'USD')
    .not('value_numeric', 'is', null);

  const totalCost = costEvents?.reduce((sum, e) => sum + (Number(e.value_numeric) || 0), 0) || 0;

  return NextResponse.json({
    totalEvents: byApp?.length || 0,
    errorCount,
    appCounts,
    categoryCounts,
    avgDurationMs: avgDuration,
    totalCostUsd: totalCost,
    period: { hours, since },
  });
}
