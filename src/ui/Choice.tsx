import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
}

interface SingleProps<T extends string> {
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (value: T) => void
  ariaLabel: string
}

/** Список крупных карточек-вариантов (один выбор). */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SingleProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="space-y-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              active ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:bg-surface-2',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                active ? 'border-accent bg-accent text-accent-fg' : 'border-border',
              )}
            >
              {active && <Check className="size-4" />}
            </span>
            <span>
              <span className="block font-medium">{o.label}</span>
              {o.description && <span className="text-muted block text-sm">{o.description}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface MultiProps<T extends string> {
  options: ChoiceOption<T>[]
  values: T[]
  onChange: (values: T[]) => void
  ariaLabel: string
  /** Компактные «чипы» в строку вместо списка. */
  compact?: boolean
}

/** Множественный выбор: чипы или список. */
export function MultiChoice<T extends string>({
  options,
  values,
  onChange,
  ariaLabel,
  compact,
}: MultiProps<T>) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(compact ? 'flex flex-wrap gap-2' : 'space-y-2')}
    >
      {options.map((o) => {
        const active = values.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-xl border text-left transition-colors',
              compact
                ? 'min-h-11 px-4 py-2 text-sm font-medium'
                : 'flex w-full items-center gap-3 px-4 py-3',
              active ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:bg-surface-2',
            )}
          >
            {!compact && (
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md border-2',
                  active ? 'border-accent bg-accent text-accent-fg' : 'border-border',
                )}
              >
                {active && <Check className="size-4" />}
              </span>
            )}
            <span className="font-medium">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
