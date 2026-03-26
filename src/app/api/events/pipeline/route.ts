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
    'llm.evaluation', 'llm.evaluation.pdf',
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

  const decided = accepted + rejected;
  const acceptanceRate = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

  // Per-run stage durations: for each emailId run, decompose total time
  // using the nearest LLM event's duration_ms to split pre-LLM vs LLM time
  const llmEvents = events.filter(e =>
    (e.event_name === 'llm.evaluation' || e.event_name === 'llm.evaluation.pdf') && e.duration_ms != null
  );

  const receivedDurations: number[] = [];
  const evalDurations: number[] = [];
  const acceptedDurations: number[] = [];
  const totalDurations: number[] = [];

  for (const stages of Object.values(stageMap)) {
    const terminal = stages['Accepted'] || stages['Rejected'];
    if (!stages['Received'] || !terminal) continue;

    const receivedAt = new Date(stages['Received']).getTime();
    const terminalAt = new Date(terminal).getTime();
    const totalMs = terminalAt - receivedAt;
    if (totalMs <= 0 || totalMs > 3600000) continue;

    totalDurations.push(totalMs);

    // Find nearest LLM event within this run's time window
    const llm = llmEvents.find(e => {
      const t = new Date(e.occurred_at).getTime();
      return t >= receivedAt && t <= terminalAt;
    });

    if (llm && llm.duration_ms) {
      const llmEndAt = new Date(llm.occurred_at).getTime();
      const llmMs = llm.duration_ms;
      const preLlmMs = (llmEndAt - llmMs) - receivedAt;
      const postLlmMs = terminalAt - llmEndAt;

      if (preLlmMs >= 0) receivedDurations.push(preLlmMs);
      evalDurations.push(llmMs);
      if (postLlmMs >= 0) acceptedDurations.push(postLlmMs);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const avgReceivedMs = avg(receivedDurations);
  const avgEvalMs = avg(evalDurations);
  const avgAcceptedMs = avg(acceptedDurations);
  const avgDurationMs = avg(totalDurations);

  // Conversion transitions (no timing pills — timing is in stage blocks)
  const transitions: { from: string; to: string; avgMs: number; medianMs: number; count: number }[] = [];

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
        { name: 'Received', count: received, description: 'Intake and classification', avgDurationMs: avgReceivedMs },
        { name: 'Evaluated', count: evaluated, description: 'LLM extracts and validates', avgDurationMs: avgEvalMs },
        { name: 'Accepted', count: accepted, description: 'Compliance, save and reply', avgDurationMs: avgAcceptedMs },
      ],
      rejectedStage: { name: 'Rejected', count: rejected, fromStage: 'Evaluated' },
      transitions,
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
    'bom.uploaded', 'files.uploaded', 'analysis.started', 'analysis.completed',
    'analysis.failed', 'report.exported_pdf',
  ];
  // Funnel stages:
  // Data Load = files.uploaded (user has loaded all files — BOM + lots)
  // Analyze   = analysis.completed (system finished analysis)
  // Review    = implicit (time between completed and exported)
  // Export    = report.exported_pdf

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
        (e.event_name === 'bom.uploaded' || e.event_name === 'files.uploaded') ? 'Data Load' :
        e.event_name === 'analysis.started' ? '_started' :
        e.event_name === 'analysis.completed' ? 'Analyze' :
        e.event_name === 'analysis.failed' ? 'Failed' :
        e.event_name === 'report.exported_pdf' ? 'Export' : null;
      if (stage && !stageMap[runId][stage]) {
        stageMap[runId][stage] = e.occurred_at;
      }
    }
  }

  // Count unique runs that reached each stage
  const stageValues = Object.values(stageMap);
  const dataLoad = stageValues.filter(s => s['Data Load']).length;
  const analyze = stageValues.filter(s => s['Analyze']).length;
  const failed = stageValues.filter(s => s['Failed']).length;
  const exported = stageValues.filter(s => s['Export']).length;
  const review = analyze;

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
  const failedAnalysis = analyze - passed;
  const passRate = analyze > 0 ? Math.round((passed / analyze) * 100) : 0;

  // Per-stage average durations (time spent IN each stage)
  const stageDurations: Record<string, number[]> = {
    'Data Load': [], 'Analyze': [], 'Review': [],
  };
  for (const stages of Object.values(stageMap)) {
    // Data Load = bom.uploaded/files.uploaded → analysis.started
    if (stages['Data Load'] && stages['_started']) {
      const ms = new Date(stages['_started']).getTime() - new Date(stages['Data Load']).getTime();
      if (ms >= 0 && ms < 3600000) stageDurations['Data Load'].push(ms);
    }
    // Analyze = analysis.started → analysis.completed
    if (stages['_started'] && stages['Analyze']) {
      const ms = new Date(stages['Analyze']).getTime() - new Date(stages['_started']).getTime();
      if (ms >= 0 && ms < 3600000) stageDurations['Analyze'].push(ms);
    }
    // Review = analysis.completed → report.exported_pdf
    if (stages['Analyze'] && stages['Export']) {
      const ms = new Date(stages['Export']).getTime() - new Date(stages['Analyze']).getTime();
      if (ms >= 0 && ms < 3600000) stageDurations['Review'].push(ms);
    }
  }
  const avgStageDuration = (key: string) => {
    const d = stageDurations[key];
    return d && d.length > 0 ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
  };

  // Total pipeline duration = sum of stage averages (consistent with display)
  const stageAvgs = ['Data Load', 'Analyze', 'Review'].map(avgStageDuration).filter((v): v is number => v != null);
  const avgDurationMs = stageAvgs.length > 0 ? stageAvgs.reduce((a, b) => a + b, 0) : null;

  // Conversion transitions between stages
  const transitions: { from: string; to: string; avgMs: number; medianMs: number; count: number }[] = [];

  return Response.json({
    pipelines: [{
      id: 'bom_verification',
      name: 'BOM Verification',
      stages: [
        { name: 'Data Load', count: dataLoad, description: 'User completes setup and file loads', avgDurationMs: avgStageDuration('Data Load') },
        { name: 'Analyze', count: analyze, description: 'System performs analysis', avgDurationMs: avgStageDuration('Analyze') },
        { name: 'Review', count: review, description: 'User reviews results', avgDurationMs: avgStageDuration('Review') },
        { name: 'Export', count: exported, description: 'User exports report' },
      ],
      rejectedStage: failed > 0 ? { name: 'Failed', count: failed, fromStage: 'Analyze' } : undefined,
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
