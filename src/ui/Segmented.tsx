import { cn } from '@/lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

/**
 * Переключатель из нескольких сегментов (пол, тема, единицы).
 * Выбранный сегмент заливается акцентным цветом: белое на светло-сером было почти не видно.
 */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="bg-surface-2 flex gap-1 rounded-xl border border-border p-1"
    >
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors',
              active ? 'bg-accent text-accent-fg shadow-sm' : 'text-muted hover:bg-surface',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
