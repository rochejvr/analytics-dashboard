'use client';

interface PipelineStage { name: string; count: number }
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

const FILLS = [
  ['#3b82f6', '#1d4ed8'],
  ['#0ea5e9', '#0284c7'],
  ['#14b8a6', '#0d9488'],
  ['#22c55e', '#16a34a'],
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

function tColor(ms: number): string {
  if (ms < 5000) return '#22c55e';
  if (ms < 30000) return '#2563eb';
  if (ms < 120000) return '#f59e0b';
  return '#ef4444';
}

export function PipelineFunnel({ pipeline }: PipelineFunnelProps) {
  const { stages, rejectedStage, transitions, passRate, passLabel, avgDurationMs, extraMetrics, byType } = pipeline;
  const maxCount = Math.max(...stages.map(s => s.count), 1);
  const n = stages.length;
  const types = Object.entries(byType).sort((a, b) => b[1].total - a[1].total);

  const tm: Record<string, Transition> = {};
  for (const t of transitions) tm[`${t.from}→${t.to}`] = t;
  const hasTiming = transitions.length > 0;

  // SVG geometry
  const W = 480, maxH = 72;
  const timingRow = hasTiming ? 28 : 0;
  const top = timingRow + 4;
  const cy = top + maxH / 2;
  const labelY = top + maxH + 13;
  const rejH = rejectedStage && rejectedStage.count > 0 ? 34 : 0;
  const H = labelY + 6 + rejH;
  const sw = W / n, gap = 2;

  const ht = (i: number) => Math.max((i < n ? stages[i].count : stages[n - 1].count) / maxCount, 0.06) * maxH;

  const shapes = stages.map((stage, i) => {
    const x1 = i * sw + (i > 0 ? gap : 0);
    const x2 = (i + 1) * sw - (i < n - 1 ? gap : 0);
    const hL = ht(i), hR = ht(i + 1);
    const fills = FILLS[Math.min(i, FILLS.length - 1)];
    return { x1, x2, hL, hR, cx: (x1 + x2) / 2, fills, stage, i, isLast: i === n - 1 };
  });

  // Conversion % at each boundary
  const convAt = (i: number) => {
    if (i >= n - 1 || stages[i].count === 0) return null;
    return Math.round((stages[i + 1].count / stages[i].count) * 100);
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      {/* Header */}
      <div className="px-4 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--foreground)' }}>{pipeline.name}</span>
        </div>
        {avgDurationMs != null && (
          <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full" style={{ color: 'var(--muted)', background: 'var(--background)' }}>
            Avg {fmt(avgDurationMs)}
          </span>
        )}
      </div>

      <div className="flex">
        {/* SVG Funnel */}
        <div className="flex-1 min-w-0 px-3 pt-1 pb-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              {shapes.map(s => (
                <linearGradient key={s.i} id={`fg${pipeline.id}${s.i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={s.fills[0]} />
                  <stop offset="100%" stopColor={s.fills[1]} />
                </linearGradient>
              ))}
              {/* Subtle top highlight */}
              <linearGradient id={`fghl${pipeline.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Timing pills above funnel */}
            {hasTiming && stages.slice(0, -1).map((stage, i) => {
              const tr = tm[`${stage.name}→${stages[i + 1].name}`];
              if (!tr) return null;
              const bx = (i + 1) * sw;
              const tc = tColor(tr.avgMs);
              const label = fmt(tr.avgMs);
              const tw = Math.max(label.length * 5.5 + 14, 36);
              return (
                <g key={`t${i}`}>
                  <rect x={bx - tw / 2} y={2} width={tw} height={16} rx={8}
                    fill={`${tc}14`} stroke={`${tc}30`} strokeWidth="0.7" />
                  <text x={bx} y={11} textAnchor="middle" dominantBaseline="central"
                    fill={tc} fontSize="8" fontWeight="700"
                    style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {label}
                  </text>
                  {/* Dotted line down to funnel */}
                  <line x1={bx} y1={18} x2={bx} y2={cy - ht(i + 1) / 2}
                    stroke={tc} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.35" />
                </g>
              );
            })}

            {/* Funnel trapezoids */}
            {shapes.map(s => (
              <g key={s.i}>
                {/* Main shape */}
                <path
                  d={`M${s.x1},${cy - s.hL / 2}L${s.x2},${cy - s.hR / 2}L${s.x2},${cy + s.hR / 2}L${s.x1},${cy + s.hL / 2}Z`}
                  fill={`url(#fg${pipeline.id}${s.i})`}
                />
                {/* Top highlight for 3D effect */}
                <path
                  d={`M${s.x1},${cy - s.hL / 2}L${s.x2},${cy - s.hR / 2}L${s.x2},${cy + s.hR / 2}L${s.x1},${cy + s.hL / 2}Z`}
                  fill={`url(#fghl${pipeline.id})`}
                />
                {/* Count */}
                {s.stage.count > 0 ? (
                  <text x={s.cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                    fill="white" fontSize="15" fontWeight="800"
                    style={{ fontFamily: 'ui-monospace, monospace', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    {s.stage.count}
                  </text>
                ) : (
                  <text x={s.cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                    fill="white" fontSize="11" fontWeight="600" opacity="0.5">
                    0
                  </text>
                )}
                {/* Stage name */}
                <text x={s.cx} y={labelY} textAnchor="middle"
                  fill="var(--muted)" fontSize="10" fontWeight="500">
                  {s.stage.name}
                </text>
              </g>
            ))}

            {/* Conversion % badges at boundaries */}
            {stages.slice(0, -1).map((_, i) => {
              const pct = convAt(i);
              if (pct == null) return null;
              const bx = (i + 1) * sw;
              const bh = ht(i + 1);
              // Position: on the boundary line, bottom edge of funnel
              const by = cy + bh / 2 + 1;
              return (
                <g key={`cv${i}`}>
                  <text x={bx} y={by + 10} textAnchor="middle"
                    fill="var(--muted)" fontSize="8" fontWeight="600" opacity="0.6"
                    style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Rejected leak */}
            {rejectedStage && rejectedStage.count > 0 && (() => {
              const fromIdx = stages.findIndex(s => s.name === rejectedStage.fromStage);
              const bx = fromIdx >= 0 ? (fromIdx + 1) * sw : W * 0.7;
              const by = cy + ht(fromIdx >= 0 ? fromIdx + 1 : n - 1) / 2;
              return (
                <g>
                  {/* Drip path */}
                  <path d={`M${bx},${by} L${bx - 10},${by + 14} L${bx + 10},${by + 14}Z`}
                    fill="#ef444425" />
                  <text x={bx} y={by + 24} textAnchor="middle"
                    fill="#ef4444" fontSize="11" fontWeight="800"
                    style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {rejectedStage.count}
                  </text>
                  <text x={bx} y={by + 33} textAnchor="middle"
                    fill="#ef4444" fontSize="7.5" fontWeight="500" opacity="0.7">
                    {rejectedStage.name}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* KPI sidebar */}
        <div className="shrink-0 border-l flex flex-col justify-center gap-2 px-3 py-2" style={{ borderColor: 'var(--card-border)', width: 130 }}>
          {/* Pass rate — ring */}
          <div className="flex items-center gap-2">
            <div className="relative" style={{ width: 36, height: 36 }}>
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="var(--card-border)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="14" fill="none"
                  stroke={passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="2.5"
                  strokeDasharray={`${passRate * 0.88} 88`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
                style={{ color: passRate >= 80 ? '#16a34a' : passRate >= 50 ? '#d97706' : '#dc2626' }}>
                {passRate}%
              </span>
            </div>
            <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--muted)' }}>
              {passLabel}
            </span>
          </div>

          {/* Extra metrics */}
          {extraMetrics?.map(m => (
            <div key={m.label} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: m.color || 'var(--muted)' }}>
                  {m.value}
                </span>
              </div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Type breakdown */}
      {types.length > 1 && (
        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {types.map(([type, stats]) => (
              <div key={type} className="flex items-center gap-2 min-w-[130px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[type] || '#94a3b8' }} />
                <span className="text-[10px] font-medium" style={{ color: 'var(--foreground)' }}>
                  {TYPE_LABELS[type] || type}
                </span>
                <span className="text-[9px] tabular-nums" style={{ color: 'var(--muted)' }}>
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
