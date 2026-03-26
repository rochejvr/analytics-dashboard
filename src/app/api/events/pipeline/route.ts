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

  if (appId === 'bom_analysis') {
    return handleBomPipeline(hours, since);
  }
  return handleInvoicePipeline(hours, since);
}

// ── Invoice Eval Pipeline ──────────────────────────────────────────────
async function handleInvoicePipeline(hours: number, since: string) {
  const eventNames = [
    'email.received', 'invoice.evaluated', 'invoice.accepted',
    'invoice.rejected', 'invoice.duplicate', 'claim.accepted',
  ];

  const { data: events } = await supabase!
    .from('activity_events')
    .select('event_name, duration_ms, metadata, occurred_at, actor_email')
    .eq('app_id', 'invoice_eval')
    .in('event_name', eventNames)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true });

  if (!events || events.length === 0) {
    return emptyResponse(hours, since);
  }

  // Build emailId → timestamps map for each stage
  const stageMap: Record<string, Record<string, string>> = {};
  for (const e of events) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const eid = meta.emailId as string;
    if (!eid) continue;
    if (!stageMap[eid]) stageMap[eid] = {};

    const stageName =
      e.event_name === 'email.received' ? 'Received' :
      e.event_name === 'invoice.evaluated' ? 'Evaluated' :
      (e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted') ? 'Accepted' :
      e.event_name === 'invoice.rejected' ? 'Rejected' : null;

    if (stageName && !stageMap[eid][stageName]) {
      stageMap[eid][stageName] = e.occurred_at;
    }
  }

  // Stage counts
  const received = events.filter(e => e.event_name === 'email.received').length;
  const evaluated = events.filter(e => e.event_name === 'invoice.evaluated').length;
  const accepted = events.filter(e => e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted').length;
  const rejected = events.filter(e => e.event_name === 'invoice.rejected').length;
  const duplicates = events.filter(e => e.event_name === 'invoice.duplicate').length;

  // Compute inter-stage timings
  const transitions = computeTransitions(stageMap, [
    ['Received', 'Evaluated'],
    ['Evaluated', 'Accepted'],
  ]);

  // Also compute Evaluated → Rejected timing
  const rejTransitions = computeTransitions(stageMap, [['Evaluated', 'Rejected']]);

  const decided = accepted + rejected;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  // Full pipeline duration
  const fullDurations: number[] = [];
  for (const stages of Object.values(stageMap)) {
    if (stages['Received'] && (stages['Accepted'] || stages['Rejected'])) {
      const end = stages['Accepted'] || stages['Rejected'];
      const ms = new Date(end).getTime() - new Date(stages['Received']).getTime();
      if (ms > 0) fullDurations.push(ms);
    }
  }
  const avgDurationMs = fullDurations.length > 0
    ? Math.round(fullDurations.reduce((a, b) => a + b, 0) / fullDurations.length)
    : null;

  // By invoice type
  const terminalEvents = events.filter(e =>
    ['invoice.accepted', 'invoice.rejected', 'claim.accepted'].includes(e.event_name)
  );
  const byType = computeByType(terminalEvents, stageMap);

  return Response.json({
    pipelines: [{
      id: 'invoice_intake',
      name: 'Invoice Intake',
      stages: [
        { name: 'Received', count: received },
        { name: 'Evaluated', count: evaluated },
        { name: 'Accepted', count: accepted },
      ],
      rejectedStage: { name: 'Rejected', count: rejected, fromStage: 'Evaluated' },
      transitions: [
        ...transitions,
        ...(rejTransitions.length > 0 ? rejTransitions.map(t => ({ ...t, to: 'Rejected' })) : []),
      ],
      passRate: acceptanceRate,
      passLabel: 'Acceptance',
      avgDurationMs,
      extraMetrics: duplicates > 0 ? [{ label: 'Duplicates', value: duplicates }] : [],
      byType,
    }],
    period: { hours, since },
  });
}

// ── BOM Analysis Pipeline ──────────────────────────────────────────────
async function handleBomPipeline(hours: number, since: string) {
  const eventNames = [
    'bom.uploaded', 'analysis.started', 'analysis.completed',
    'analysis.failed', 'report.exported_pdf',
  ];

  const { data: events } = await supabase!
    .from('activity_events')
    .select('event_name, duration_ms, metadata, occurred_at, actor_email, actor_id')
    .eq('app_id', 'bom_analysis')
    .in('event_name', eventNames)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true });

  if (!events || events.length === 0) {
    return emptyResponse(hours, since);
  }

  // Group into runs by proximity (events within 30 min of each other from same actor)
  type Run = { events: typeof events; actor: string };
  const runs: Run[] = [];
  let currentRun: Run | null = null;

  for (const e of events) {
    const actor = e.actor_email || e.actor_id || 'unknown';
    const ts = new Date(e.occurred_at).getTime();

    if (
      !currentRun ||
      currentRun.actor !== actor ||
      ts - new Date(currentRun.events[currentRun.events.length - 1].occurred_at).getTime() > 30 * 60 * 1000
    ) {
      currentRun = { events: [e], actor };
      runs.push(currentRun);
    } else {
      currentRun.events.push(e);
    }
  }

  // Build stage map per run
  const stageMap: Record<string, Record<string, string>> = {};
  for (let i = 0; i < runs.length; i++) {
    const runId = `run_${i}`;
    stageMap[runId] = {};
    for (const e of runs[i].events) {
      const stage =
        e.event_name === 'bom.uploaded' ? 'Uploaded' :
        e.event_name === 'analysis.started' ? 'Started' :
        e.event_name === 'analysis.completed' ? 'Completed' :
        e.event_name === 'analysis.failed' ? 'Failed' :
        e.event_name === 'report.exported_pdf' ? 'Exported' : null;
      if (stage && !stageMap[runId][stage]) {
        stageMap[runId][stage] = e.occurred_at;
      }
    }
  }

  // Count unique runs that reached each stage (prevents reruns inflating counts)
  const stageValues = Object.values(stageMap);
  const uploaded = stageValues.filter(s => s['Uploaded']).length;
  const started = stageValues.filter(s => s['Started']).length;
  const completed = stageValues.filter(s => s['Completed']).length;
  const failed = stageValues.filter(s => s['Failed']).length;
  const exported = stageValues.filter(s => s['Exported']).length;

  // Pass/fail: check the last analysis.completed event per run
  let passed = 0;
  for (const run of runs) {
    const completedEvts = run.events.filter(e => e.event_name === 'analysis.completed');
    if (completedEvts.length > 0) {
      const last = completedEvts[completedEvts.length - 1];
      const meta = (last.metadata || {}) as Record<string, unknown>;
      if (meta.overall_pass === true) passed++;
    }
  }
  const failedAnalysis = completed - passed;

  const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

  // Transitions
  const transitions = computeTransitions(stageMap, [
    ['Uploaded', 'Started'],
    ['Started', 'Completed'],
    ['Completed', 'Exported'],
  ]);

  // Full pipeline duration (upload → export or upload → completed)
  const fullDurations: number[] = [];
  for (const stages of Object.values(stageMap)) {
    const start = stages['Uploaded'] || stages['Started'];
    const end = stages['Exported'] || stages['Completed'];
    if (start && end) {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      if (ms > 0) fullDurations.push(ms);
    }
  }
  const avgDurationMs = fullDurations.length > 0
    ? Math.round(fullDurations.reduce((a, b) => a + b, 0) / fullDurations.length)
    : null;

  return Response.json({
    pipelines: [{
      id: 'bom_verification',
      name: 'BOM Verification',
      stages: [
        { name: 'Uploaded', count: uploaded },
        { name: 'Started', count: started },
        { name: 'Completed', count: completed },
        { name: 'Exported', count: exported },
      ],
      rejectedStage: failed > 0 ? { name: 'Failed', count: failed, fromStage: 'Started' } : undefined,
      transitions,
      passRate,
      passLabel: 'Pass Rate',
      avgDurationMs,
      extraMetrics: [
        ...(passed > 0 ? [{ label: 'Passed', value: passed, color: 'var(--success)' }] : []),
        ...(failedAnalysis > 0 ? [{ label: 'Failed Checks', value: failedAnalysis, color: 'var(--error)' }] : []),
      ],
      byType: {},
    }],
    period: { hours, since },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function computeTransitions(
  stageMap: Record<string, Record<string, string>>,
  pairs: [string, string][]
): { from: string; to: string; avgMs: number; medianMs: number; count: number }[] {
  return pairs.map(([from, to]) => {
    const durations: number[] = [];
    for (const stages of Object.values(stageMap)) {
      if (stages[from] && stages[to]) {
        const ms = new Date(stages[to]).getTime() - new Date(stages[from]).getTime();
        if (ms > 0 && ms < 3600000) durations.push(ms); // cap at 1hr to filter noise
      }
    }
    durations.sort((a, b) => a - b);
    const avg = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const median = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
    return { from, to, avgMs: avg, medianMs: median, count: durations.length };
  }).filter(t => t.count > 0);
}

function computeByType(
  terminalEvents: { event_name: string; metadata: unknown; occurred_at: string }[],
  stageMap: Record<string, Record<string, string>>
) {
  type TypeStats = { accepted: number; rejected: number; total: number; acceptanceRate: number; avgDurationMs: number | null };
  const byType: Record<string, TypeStats> = {};

  for (const e of terminalEvents) {
    const meta = (e.metadata || {}) as Record<string, unknown>;
    const invoiceType = (meta.invoiceType as string) || 'unknown';
    if (!byType[invoiceType]) {
      byType[invoiceType] = { accepted: 0, rejected: 0, total: 0, acceptanceRate: 0, avgDurationMs: null };
    }
    if (e.event_name === 'invoice.accepted' || e.event_name === 'claim.accepted') {
      byType[invoiceType].accepted++;
    } else {
      byType[invoiceType].rejected++;
    }
    byType[invoiceType].total++;
  }

  for (const stats of Object.values(byType)) {
    const decided = stats.accepted + stats.rejected;
    stats.acceptanceRate = decided > 0 ? Math.round((stats.accepted / decided) * 100) : 0;
  }

  return byType;
}

function emptyResponse(hours: number, since: string) {
  return Response.json({ pipelines: [], period: { hours, since } });
}
