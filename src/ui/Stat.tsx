import { cn } from '@/lib/cn'

interface StatProps {
  label: string
  value: string
  className?: string
}

/** Крупная цифра с подписью для сводок. */
export function Stat({ label, value, className }: StatProps) {
  return (
    <div className={cn('bg-surface-2 rounded-xl p-3', className)}>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-muted text-xs">{label}</div>
    </div>
  )
}

interface BarProps {
  /** 0…1 */
  value: number
  className?: string
  label?: string
}

export function ProgressBar({ value, className, label }: BarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('bg-surface-2 h-3 w-full overflow-hidden rounded-full', className)}
    >
      <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
