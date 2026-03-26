'use client';

interface PipelineStage {
  name: string;
  count: number;
}

interface PipelineData {
  id: string;
  name: string;
  stages: PipelineStage[];
  rejected: number;
  duplicates: number;
  acceptanceRate: number;
  avgDurationMs: number | null;
  byType: Record<string, {
    accepted: number; rejected: number; duplicate: number;
    total: number; acceptanceRate: number; avgDurationMs: number | null;
  }>;
}

interface PipelineFunnelProps {
  pipeline: PipelineData;
}

const TYPE_COLORS: Record<string, string> = {
  general: '#2563eb',
  courier: '#d97706',
  claim: '#7c3aed',
  unknown: '#94a3b8',
};

const TYPE_LABELS: Record<string, string> = {
  general: 'General',
  courier: 'Courier',
  claim: 'Claims',
  unknown: 'Unknown',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
}

export function PipelineFunnel({ pipeline }: PipelineFunnelProps) {
  const { stages, rejected, duplicates, acceptanceRate, avgDurationMs, byType } = pipeline;
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const types = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
    >
      {/* Header bar */}
      <div
        className="px-5 py-3 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {pipeline.name}
          </span>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ color: 'var(--muted)', background: 'var(--background)' }}>
          Pipeline
        </span>
      </div>

      <div className="p-5">
        {/* Funnel stages + KPI strip */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Funnel visualization */}
          <div className="flex-1 min-w-0">
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {stages.map((stage, i) => {
                const ratio = stage.count / maxCount;
                const barH = Math.max(ratio * 100, 8);
                const isLast = i === stages.length - 1;
                return (
                  <div key={stage.name} className="flex-1 flex flex-col items-center gap-1">
                    {/* Count label */}
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                      {stage.count}
                    </span>
                    {/* Bar */}
                    <div className="w-full flex justify-center">
                      <div
                        className="rounded-t-md transition-all duration-500"
                        style={{
                          width: `${60 + ratio * 40}%`,
                          height: barH,
                          background: isLast
                            ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                            : `linear-gradient(180deg, var(--accent) 0%, #1d4ed8 100%)`,
                          opacity: 0.15 + ratio * 0.85,
                        }}
                      />
                    </div>
                    {/* Stage name */}
                    <span className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>
                      {stage.name}
                    </span>
                    {/* Arrow connector */}
                    {i < stages.length - 1 && (
                      <div className="absolute" style={{ display: 'none' }} />
                    )}
                  </div>
                );
              })}

              {/* Rejected column */}
              {rejected > 0 && (
                <div className="flex-1 flex flex-col items-center gap-1 max-w-[80px]">
                  <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--error)' }}>
                    {rejected}
                  </span>
                  <div className="w-full flex justify-center">
                    <div
                      className="rounded-t-md"
                      style={{
                        width: `${60 + (rejected / maxCount) * 40}%`,
                        height: Math.max((rejected / maxCount) * 100, 8),
                        background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                        opacity: 0.4,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--error)' }}>
                    Rejected
                  </span>
                </div>
              )}
            </div>

            {/* Flow arrows */}
            <div className="flex items-center mt-3 mx-2">
              {stages.map((stage, i) => (
                <div key={stage.name} className="flex-1 flex items-center">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background: i < stages.length - 1
                        ? 'linear-gradient(90deg, var(--accent) 0%, var(--card-border) 100%)'
                        : 'transparent',
                    }}
                  />
                  {i < stages.length - 1 && (
                    <svg width="8" height="10" viewBox="0 0 8 10" style={{ color: 'var(--accent)', opacity: 0.5 }}>
                      <path d="M1 1L6 5L1 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
              {rejected > 0 && <div className="max-w-[80px] flex-1" />}
            </div>
          </div>

          {/* KPI strip */}
          <div className="flex lg:flex-col gap-4 lg:gap-3 lg:w-48 lg:border-l lg:pl-5" style={{ borderColor: 'var(--card-border)' }}>
            {/* Acceptance rate — ring gauge */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke="var(--card-border)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke={acceptanceRate >= 80 ? '#22c55e' : acceptanceRate >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${acceptanceRate * 0.9425} 94.25`}
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums"
                  style={{ color: acceptanceRate >= 80 ? '#16a34a' : acceptanceRate >= 50 ? '#d97706' : '#dc2626' }}
                >
                  {acceptanceRate}%
                </span>
              </div>
              <div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>First Pass</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Acceptance</div>
              </div>
            </div>

            {/* Avg duration */}
            <div className="flex items-center gap-3">
              <div
                className="w-[52px] h-[52px] rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--background)' }}
              >
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {avgDurationMs ? formatDuration(avgDurationMs).replace(/\.\d/, '') : '—'}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Avg Pipeline</div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Duration</div>
              </div>
            </div>

            {/* Duplicates */}
            {duplicates > 0 && (
              <div className="flex items-center gap-3">
                <div
                  className="w-[52px] h-[52px] rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--background)' }}
                >
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--muted)' }}>
                    {duplicates}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Duplicates</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Skipped</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Type breakdown — mini bars */}
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
                    {/* Mini bar */}
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)', minWidth: 40 }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${stats.acceptanceRate}%`,
                          background: TYPE_COLORS[type] || TYPE_COLORS.unknown,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    {stats.avgDurationMs && (
                      <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--muted)' }}>
                        {formatDuration(stats.avgDurationMs)}
                      </span>
                    )}
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
