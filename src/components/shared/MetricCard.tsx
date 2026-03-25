interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
}

export function MetricCard({ label, value, subtitle, color = 'var(--accent)' }: MetricCardProps) {
  return (
    <div
      className="rounded-xl border p-4 sm:p-5"
      style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
    >
      <div className="text-[11px] sm:text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-xl sm:text-2xl font-bold truncate" style={{ color }}>{value}</div>
      {subtitle && <div className="text-[11px] sm:text-xs mt-1 truncate" style={{ color: 'var(--muted)' }}>{subtitle}</div>}
    </div>
  );
}
