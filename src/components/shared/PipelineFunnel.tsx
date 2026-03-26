'use client';

interface PipelineStage {
  name: string;
  count: number;
}

interface Transition {
  from: string;
  to: string;
  avgMs: number;
  medianMs: number;
  count: number;
}

interface RejectedStage {
  name: string;
  count: number;
  fromStage: string;
}

interface ExtraMetric {
  label: string;
  value: number;
  color?: string;
}

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

interface PipelineFunnelProps {
  pipeline: PipelineData;
}

const TYPE_COLORS: Record<string, string> = {
  general: '#2563eb', courier: '#d97706', claim: '#7c3aed', unknown: '#94a3b8',
};
const TYPE_LABELS: Record<string, string> = {
  general: 'General', courier: 'Courier', claim: 'Claims', unknown: 'Unknown',
};

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  if (mins < 60) return remainSecs > 0 ? `${mins}m ${remainSecs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function timingColor(ms: number): string {
  if (ms < 5000) return '#22c55e';
  if (ms < 30000) return '#2563eb';
  if (ms < 120000) return '#f59e0b';
  return '#ef4444';
}

const BAR_MAX_H = 64;
const BAR_MIN_H = 6;
const BAR_WIDTH = 48;

export function PipelineFunnel({ pipeline }: PipelineFunnelProps) {
  const { stages, rejectedStage, transitions, passRate, passLabel, avgDurationMs, extraMetrics, byType } = pipeline;
  const allCounts = [...stages.map(s => s.count), rejectedStage?.count || 0];
  const maxCount = Math.max(...allCounts, 1);
  const types = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);

  const transMap: Record<string, Transition> = {};
  for (const t of transitions) transMap[`${t.from}→${t.to}`] = t;

  function barHeight(count: number): number {
    if (count === 0) return BAR_MIN_H;
    return BAR_MIN_H + (count / maxCount) * (BAR_MAX_H - BAR_MIN_H);
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{pipeline.name}</span>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--muted)', background: 'var(--background)' }}>
          Pipeline
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-4">
          {/* ── Funnel flow ── */}
          <div className="flex-1 min-w-0 flex items-center">
            {stages.map((stage, i) => {
              const nextStage = stages[i + 1];
              const trans = nextStage ? transMap[`${stage.name}→${nextStage.name}`] : null;
              const isLast = i === stages.length - 1;
              const h = barHeight(stage.count);

              return (
                <div key={stage.name} className="contents">
                  {/* Stage node */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      className="rounded"
                      style={{
                        width: 8,
                        height: h,
                        background: isLast
                          ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                          : 'var(--accent)',
                        opacity: isLast ? 0.75 : 0.15 + (stage.count / maxCount) * 0.85,
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold tabular-nums leading-none" style={{ color: 'var(--foreground)' }}>
                        {stage.count}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                        {stage.name}
                      </span>
                    </div>
                  </div>

                  {/* Connector */}
                  {!isLast && (
                    <div className="flex-1 flex flex-col items-center justify-center min-w-[40px] px-1">
                      {trans ? (
                        <>
                          <div
                            className="px-1.5 py-px rounded-full text-[9px] font-semibold tabular-nums whitespace-nowrap"
                            style={{
                              background: `color-mix(in srgb, ${timingColor(trans.avgMs)} 10%, transparent)`,
                              color: timingColor(trans.avgMs),
                              border: `1px solid color-mix(in srgb, ${timingColor(trans.avgMs)} 20%, transparent)`,
                            }}
                          >
                            {fmtDuration(trans.avgMs)}
                          </div>
                          <div className="w-full flex items-center mt-0.5">
                            <div className="flex-1 h-px" style={{ background: `color-mix(in srgb, ${timingColor(trans.avgMs)} 35%, var(--card-border))` }} />
                            <svg width="5" height="7" viewBox="0 0 5 7" className="shrink-0 -ml-px" style={{ color: timingColor(trans.avgMs), opacity: 0.6 }}>
                              <path d="M1 1L3.5 3.5L1 6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                            </svg>
                          </div>
                          <span className="text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                            n={trans.count}
                          </span>
                        </>
                      ) : (
                        <div className="w-full flex items-center">
                          <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                          <svg width="5" height="7" viewBox="0 0 5 7" className="shrink-0 -ml-px" style={{ color: 'var(--muted)', opacity: 0.3 }}>
                            <path d="M1 1L3.5 3.5L1 6" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Rejected */}
            {rejectedStage && rejectedStage.count > 0 && (
              <div
                className="flex items-center gap-1.5 shrink-0 ml-2 pl-2 border-l border-dashed"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div
                  className="rounded"
                  style={{
                    width: 8,
                    height: barHeight(rejectedStage.count),
                    background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                    opacity: 0.3,
                  }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold tabular-nums leading-none" style={{ color: 'var(--error)' }}>
                    {rejectedStage.count}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--error)' }}>
                    {rejectedStage.name}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── KPI strip ── */}
          <div
            className="flex flex-col gap-2.5 shrink-0 border-l pl-4"
            style={{ borderColor: 'var(--card-border)', width: 150 }}
          >
            {/* Pass rate ring */}
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14.5" fill="none" stroke="var(--card-border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14.5" fill="none"
                    stroke={passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${passRate * 0.911} 91.1`}
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
                  style={{ color: passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626' }}
                >
                  {passRate}%
                </span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{passLabel}</span>
            </div>

            {/* Avg duration */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--background)' }}
              >
                <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {avgDurationMs ? fmtDuration(avgDurationMs) : '—'}
                </span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Avg Duration</span>
            </div>

            {/* Extra metrics */}
            {extraMetrics?.map(m => (
              <div key={m.label} className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--background)' }}
                >
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: m.color || 'var(--muted)' }}>
                    {m.value}
                  </span>
                </div>
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Type breakdown */}
        {types.length > 1 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {types.map(([type, stats]) => {
                const decided = stats.accepted + stats.rejected;
                return (
                  <div key={type} className="flex items-center gap-2 min-w-[140px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[type] || TYPE_COLORS.unknown }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>
                      {stats.acceptanceRate}% · {decided}
                    </span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--card-border)', minWidth: 30 }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stats.acceptanceRate}%`, background: TYPE_COLORS[type] || TYPE_COLORS.unknown, opacity: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
