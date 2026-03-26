'use client';

interface PipelineStage { name: string; count: number; description?: string; avgDurationMs?: number | null }
interface Transition { from: string; to: string; avgMs: number; medianMs: number; count: number }
interface RejectedStage { name: string; count: number; fromStage: string }
interface ExtraMetric { label: string; value: number; color?: string }

interface PipelineData {
  id: string;
  name: string;
  stages: PipelineStage[];
  rejectedStage?: RejectedStage;
  transitions: Transition[];
  passRate: number;
  passLabel: string;
  avgDurationMs: number | null;
  extraMetrics?: ExtraMetric[];
  byType: Record<string, {
    accepted: number; rejected: number;
    total: number; acceptanceRate: number; avgDurationMs: number | null;
  }>;
}

interface PipelineFunnelProps { pipeline: PipelineData }

const GRADIENTS = [
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
  'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
  'linear-gradient(135deg, #10b981 0%, #047857 100%)',
];

const TYPE_COLORS: Record<string, string> = {
  general: '#2563eb', courier: '#d97706', claim: '#7c3aed', unknown: '#94a3b8',
};
const TYPE_LABELS: Record<string, string> = {
  general: 'General', courier: 'Courier', claim: 'Claims', unknown: 'Unknown',
};

function fmt(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60), rs = Math.round(s % 60);
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function tColor(ms: number) {
  if (ms < 5000) return '#16a34a';
  if (ms < 30000) return '#2563eb';
  if (ms < 120000) return '#d97706';
  return '#dc2626';
}

const MAX_TAPER = 16; // max % indent from top/bottom

export function PipelineFunnel({ pipeline }: PipelineFunnelProps) {
  const { stages, rejectedStage, transitions, passRate, passLabel, avgDurationMs, extraMetrics, byType } = pipeline;
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const n = stages.length;
  const types = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);

  // Transition lookup — check both exact match and one-stage-back match
  const tm: Record<string, Transition> = {};
  for (const t of transitions) {
    tm[`${t.from}→${t.to}`] = t;
  }
  const findTrans = (from: string, to: string): Transition | null => {
    // Direct match
    if (tm[`${from}→${to}`]) return tm[`${from}→${to}`];
    // Check if previous stage name maps to same event (e.g., Review → Export maps to Analyze → Export)
    const fromIdx = stages.findIndex(s => s.name === from);
    if (fromIdx > 0) {
      const prevName = stages[fromIdx - 1].name;
      if (tm[`${prevName}→${to}`]) return tm[`${prevName}→${to}`];
    }
    return null;
  };

  const rawInset = (count: number) => (1 - Math.max(count / maxCount, 0.08)) * MAX_TAPER;

  // Pre-compute insets ensuring the funnel never widens (monotonic narrowing)
  const insets: number[] = [];
  for (let i = 0; i <= n; i++) {
    const count = i < n ? stages[i].count : stages[n - 1].count;
    const raw = rawInset(count);
    insets.push(i === 0 ? raw : Math.max(raw, insets[i - 1]));
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      {/* ── Header ── */}
      <div className="px-5 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{pipeline.name}</span>
        </div>
        {avgDurationMs != null && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Total Avg</span>
            <span className="text-base font-extrabold tabular-nums px-3 py-1 rounded-lg"
              style={{ color: 'var(--foreground)', background: 'var(--background)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {fmt(avgDurationMs)}
            </span>
          </div>
        )}
      </div>

      <div className="flex">
        {/* ── Funnel area ── */}
        <div className="flex-1 min-w-0 p-5 pr-3">
          {/* Funnel blocks row */}
          <div className="flex items-stretch" style={{ height: 88 }}>
            {stages.map((stage, i) => {
              const leftIn = insets[i];
              const rightIn = insets[i + 1];
              const grad = GRADIENTS[Math.min(i, GRADIENTS.length - 1)];
              const isLast = i === n - 1;

              // Connector data
              const nextStage = !isLast ? stages[i + 1] : null;
              const trans = nextStage ? findTrans(stage.name, nextStage.name) : null;
              const conv = nextStage && stage.count > 0
                ? Math.round((nextStage.count / stage.count) * 100) : null;

              return (
                <div key={i} className="contents">
                  {/* Stage block */}
                  <div
                    className="flex-1 flex flex-col items-center justify-center relative min-w-0"
                    style={{
                      background: grad,
                      clipPath: `polygon(0% ${leftIn}%, 100% ${rightIn}%, 100% ${100 - rightIn}%, 0% ${100 - leftIn}%)`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white/80 tracking-widest uppercase leading-none">
                      {stage.name}
                    </span>
                    <span className="text-[26px] font-black text-white tabular-nums leading-none mt-1"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      {stage.count}
                    </span>
                    {stage.avgDurationMs != null && (
                      <span className="text-[9px] font-semibold text-white/60 tabular-nums leading-none mt-1.5"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                        {fmt(stage.avgDurationMs)}
                      </span>
                    )}
                  </div>

                  {/* Connector between stages */}
                  {nextStage && (
                    <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 40 }}>
                      {/* Arrow */}
                      <svg width="16" height="8" viewBox="0 0 16 8" className="shrink-0" style={{ color: 'var(--card-border)' }}>
                        <path d="M0 4H13M10 1L13 4L10 7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {/* Conversion % */}
                      {conv != null && (
                        <span className="text-[9px] font-semibold tabular-nums leading-none mt-1"
                          style={{ color: 'var(--muted)', opacity: 0.6 }}>
                          {conv}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Rejected/failed indicator */}
            {rejectedStage && rejectedStage.count > 0 && (
              <div className="flex flex-col items-center justify-center shrink-0 ml-1.5 pl-3 border-l border-dashed"
                style={{ borderColor: 'var(--card-border)' }}>
                <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'var(--error)', opacity: 0.7 }}>
                  {rejectedStage.name}
                </span>
                <span className="text-xl font-black tabular-nums leading-none mt-0.5"
                  style={{ color: 'var(--error)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                  {rejectedStage.count}
                </span>
              </div>
            )}
          </div>

          {/* Descriptions row — aligned under each block */}
          {stages.some(s => s.description) && (
            <div className="flex mt-2.5">
              {stages.map((stage, i) => {
                const isLast = i === n - 1;
                return (
                  <div key={i} className="contents">
                    <div className="flex-1 min-w-0 text-center">
                      <span className="text-[10px] leading-tight" style={{ color: 'var(--muted)' }}>
                        {stage.description}
                      </span>
                    </div>
                    {!isLast && <div className="shrink-0" style={{ width: 40 }} />}
                  </div>
                );
              })}
              {rejectedStage && rejectedStage.count > 0 && (
                <div className="shrink-0" style={{ width: 40 }} />
              )}
            </div>
          )}
        </div>

        {/* ── KPI sidebar ── */}
        <div className="shrink-0 border-l flex flex-col justify-center py-5 px-5"
          style={{ borderColor: 'var(--card-border)', width: 180 }}>
          {/* Pass rate ring */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--card-border)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="2.5"
                  strokeDasharray={`${passRate * 0.942} 94.2`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold tabular-nums"
                style={{ color: passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626' }}>
                {passRate}%
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{passLabel}</div>
              <div className="text-[10px]" style={{ color: 'var(--muted)' }}>First pass</div>
            </div>
          </div>

          {/* Extra metrics — aligned grid */}
          {extraMetrics && extraMetrics.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {extraMetrics.map(m => (
                <div key={m.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--background)' }}>
                    <span className="text-sm font-extrabold tabular-nums" style={{ color: m.color || 'var(--muted)' }}>
                      {m.value}
                    </span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Type breakdown ── */}
      {types.length > 1 && (
        <div className="px-5 py-2.5 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {types.map(([type, stats]) => (
              <div key={type} className="flex items-center gap-2 min-w-[140px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[type] || '#94a3b8' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                  {TYPE_LABELS[type] || type}
                </span>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>
                  {stats.acceptanceRate}%·{stats.accepted + stats.rejected}
                </span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)', minWidth: 24 }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${stats.acceptanceRate}%`, background: TYPE_COLORS[type] || '#94a3b8', opacity: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
