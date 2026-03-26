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
  if (ms < 5000) return '#22c55e';   // fast — green
  if (ms < 30000) return '#2563eb';  // normal — blue
  if (ms < 120000) return '#f59e0b'; // slow — amber
  return '#ef4444';                   // bottleneck — red
}

export function PipelineFunnel({ pipeline }: PipelineFunnelProps) {
  const { stages, rejectedStage, transitions, passRate, passLabel, avgDurationMs, extraMetrics, byType } = pipeline;
  const maxCount = Math.max(...stages.map(s => s.count), rejectedStage?.count || 0, 1);
  const types = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);

  // Build transition lookup
  const transMap: Record<string, Transition> = {};
  for (const t of transitions) {
    transMap[`${t.from}→${t.to}`] = t;
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{pipeline.name}</span>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ color: 'var(--muted)', background: 'var(--background)' }}>
          Pipeline
        </span>
      </div>

      <div className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* ── Funnel flow ── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-stretch gap-0">
              {stages.map((stage, i) => {
                const ratio = stage.count / maxCount;
                const nextStage = stages[i + 1];
                const trans = nextStage ? transMap[`${stage.name}→${nextStage.name}`] : null;
                const isLast = i === stages.length - 1;
                const isFirst = i === 0;

                return (
                  <div key={stage.name} className="flex items-stretch" style={{ flex: trans ? '1 1 0' : '0 0 auto' }}>
                    {/* Stage node */}
                    <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
                      {/* Count */}
                      <span className="text-lg font-bold tabular-nums mb-1" style={{ color: 'var(--foreground)' }}>
                        {stage.count}
                      </span>
                      {/* Bar */}
                      <div className="w-full flex justify-center" style={{ height: 48 }}>
                        <div
                          className="rounded-md"
                          style={{
                            width: `${Math.max(ratio * 100, 20)}%`,
                            minWidth: 20,
                            height: '100%',
                            background: isLast
                              ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                              : isFirst
                                ? 'var(--accent)'
                                : `color-mix(in srgb, var(--accent) ${50 + ratio * 50}%, var(--card-border))`,
                            opacity: isLast ? 0.8 : 0.2 + ratio * 0.8,
                          }}
                        />
                      </div>
                      {/* Label */}
                      <span className="text-[11px] font-medium mt-1.5" style={{ color: 'var(--muted)' }}>
                        {stage.name}
                      </span>
                    </div>

                    {/* Connector with timing */}
                    {trans && (
                      <div className="flex-1 flex flex-col items-center justify-center px-1" style={{ minWidth: 60 }}>
                        {/* Timing pill */}
                        <div
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold tabular-nums whitespace-nowrap mb-1"
                          style={{
                            background: `color-mix(in srgb, ${timingColor(trans.avgMs)} 12%, transparent)`,
                            color: timingColor(trans.avgMs),
                            border: `1px solid color-mix(in srgb, ${timingColor(trans.avgMs)} 25%, transparent)`,
                          }}
                        >
                          {fmtDuration(trans.avgMs)}
                        </div>
                        {/* Arrow line */}
                        <div className="w-full flex items-center" style={{ height: 12 }}>
                          <div
                            className="flex-1 h-px"
                            style={{ background: `color-mix(in srgb, ${timingColor(trans.avgMs)} 40%, var(--card-border))` }}
                          />
                          <svg width="6" height="8" viewBox="0 0 6 8" className="shrink-0" style={{ color: timingColor(trans.avgMs) }}>
                            <path d="M1 1L4.5 4L1 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                          </svg>
                        </div>
                        {/* Sample count */}
                        <span className="text-[9px] mt-0.5" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                          n={trans.count}
                        </span>
                      </div>
                    )}

                    {/* Last stage has no connector but may need spacing */}
                    {!trans && !isLast && <div style={{ width: 16 }} />}
                  </div>
                );
              })}

              {/* Rejected column */}
              {rejectedStage && rejectedStage.count > 0 && (
                <div className="flex flex-col items-center ml-2 pl-2 border-l border-dashed" style={{ borderColor: 'var(--card-border)', minWidth: 56 }}>
                  <span className="text-lg font-bold tabular-nums mb-1" style={{ color: 'var(--error)' }}>
                    {rejectedStage.count}
                  </span>
                  <div className="w-full flex justify-center" style={{ height: 48 }}>
                    <div
                      className="rounded-md"
                      style={{
                        width: `${Math.max((rejectedStage.count / maxCount) * 100, 20)}%`,
                        minWidth: 20,
                        height: '100%',
                        background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                        opacity: 0.35,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium mt-1.5" style={{ color: 'var(--error)' }}>
                    {rejectedStage.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── KPI strip ── */}
          <div className="flex lg:flex-col gap-4 lg:gap-3 lg:w-44 lg:border-l lg:pl-5 flex-wrap" style={{ borderColor: 'var(--card-border)' }}>
            {/* Pass rate ring */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0" style={{ width: 48, height: 48 }}>
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
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums"
                  style={{ color: passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626' }}
                >
                  {passRate}%
                </span>
              </div>
              <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--muted)' }}>
                {passLabel}
              </div>
            </div>

            {/* Avg duration */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--background)' }}
              >
                <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {avgDurationMs ? fmtDuration(avgDurationMs) : '—'}
                </span>
              </div>
              <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--muted)' }}>
                Avg Total<br />Duration
              </div>
            </div>

            {/* Extra metrics */}
            {extraMetrics?.map(m => (
              <div key={m.label} className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--background)' }}
                >
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: m.color || 'var(--muted)' }}>
                    {m.value}
                  </span>
                </div>
                <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--muted)' }}>
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Type breakdown */}
        {types.length > 1 && (
          <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {types.map(([type, stats]) => {
                const decided = stats.accepted + stats.rejected;
                return (
                  <div key={type} className="flex items-center gap-2.5 min-w-[160px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[type] || TYPE_COLORS.unknown }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--muted)' }}>
                      {stats.acceptanceRate}% · {decided}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)', minWidth: 40 }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${stats.acceptanceRate}%`, background: TYPE_COLORS[type] || TYPE_COLORS.unknown, opacity: 0.7 }}
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
