import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const searchParams = request.nextUrl.searchParams;
  const hours = parseInt(searchParams.get('hours') || '168');
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Fetch all events in the period across all categories
  const { data: events, error } = await supabase
    .from('activity_events')
    .select('app_id, event_name, actor_id, actor_email, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = events || [];

  // ── Feature counts by app ──────────────────────────────────────
  const featureMap: Record<string, Record<string, number>> = {};
  for (const e of rows) {
    if (!featureMap[e.app_id]) featureMap[e.app_id] = {};
    featureMap[e.app_id][e.event_name] = (featureMap[e.app_id][e.event_name] || 0) + 1;
  }

  // Convert to sorted arrays per app
  const featuresByApp: Record<string, { event: string; count: number }[]> = {};
  for (const [app, features] of Object.entries(featureMap)) {
    featuresByApp[app] = Object.entries(features)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Unique actors ──────────────────────────────────────────────
  const actorSet = new Set<string>();
  const actorsByApp: Record<string, Set<string>> = {};
  for (const e of rows) {
    const actor = e.actor_email || e.actor_id || 'anonymous';
    actorSet.add(actor);
    if (!actorsByApp[e.app_id]) actorsByApp[e.app_id] = new Set();
    actorsByApp[e.app_id].add(actor);
  }

  const uniqueActors = actorSet.size;
  const actorCountsByApp: Record<string, number> = {};
  for (const [app, actors] of Object.entries(actorsByApp)) {
    actorCountsByApp[app] = actors.size;
  }

  // ── Daily usage buckets ────────────────────────────────────────
  // Group events into day buckets per app
  const dailyMap: Record<string, Record<string, number>> = {}; // date -> app -> count
  for (const e of rows) {
    const day = e.occurred_at.slice(0, 10); // YYYY-MM-DD
    if (!dailyMap[day]) dailyMap[day] = {};
    dailyMap[day][e.app_id] = (dailyMap[day][e.app_id] || 0) + 1;
  }

  // Fill in missing days so the chart is continuous
  const startDate = new Date(since);
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date();
  endDate.setUTCHours(0, 0, 0, 0);
  const allDays: string[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    allDays.push(d.toISOString().slice(0, 10));
  }

  const dailyUsage = allDays.map(day => ({
    date: day,
    ...(dailyMap[day] || {}),
  }));

  // ── Top features across all apps ───────────────────────────────
  const globalFeatures: Record<string, { count: number; app: string }> = {};
  for (const e of rows) {
    const key = `${e.app_id}:${e.event_name}`;
    if (!globalFeatures[key]) globalFeatures[key] = { count: 0, app: e.app_id };
    globalFeatures[key].count++;
  }
  const topFeatures = Object.entries(globalFeatures)
    .map(([key, val]) => ({ event: key.split(':').slice(1).join(':'), app: val.app, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // ── Trend: compare first half vs second half of period ─────────
  const midpoint = new Date(Date.now() - (hours * 60 * 60 * 1000) / 2).toISOString();
  const firstHalf = rows.filter(e => e.occurred_at < midpoint).length;
  const secondHalf = rows.filter(e => e.occurred_at >= midpoint).length;
  const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : secondHalf > 0 ? 100 : 0;

  // ── Per-app event totals ───────────────────────────────────────
  const appTotals: Record<string, number> = {};
  for (const e of rows) {
    appTotals[e.app_id] = (appTotals[e.app_id] || 0) + 1;
  }

  return NextResponse.json({
    totalEvents: rows.length,
    uniqueActors,
    actorCountsByApp,
    trendPct,
    appTotals,
    featuresByApp,
    topFeatures,
    dailyUsage,
    period: { hours, since },
  });
}
