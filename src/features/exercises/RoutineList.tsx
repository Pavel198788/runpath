import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { EXERCISES, ROUTINES } from '@content/index'
import type { Exercise } from '@content/schemas'
import { cn } from '@/lib/cn'
import { ExerciseIcon } from './ExerciseIcon'

/**
 * Конкретные упражнения комплекса прямо в карточке тренировки:
 * без списка «ОФП» ничего не говорит новичку.
 */
export function RoutineList({ routine }: { routine: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<string | null>(null)
  const list = (ROUTINES[routine] ?? [])
    .map((id) => EXERCISES.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e))

  if (list.length === 0) return null

  return (
    <div className="space-y-2">
      <ol className="divide-border divide-y">
        {list.map((e, i) => {
          const isOpen = open === e.id
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : e.id)}
                className="flex w-full items-center gap-3 py-2 text-left"
              >
                <span className="text-accent shrink-0">
                  <ExerciseIcon icon={e.icon} className="size-8" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {i + 1}. {e.name}
                  </span>
                  <span className="text-muted block text-sm">
                    {e.duration} · {e.target}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'text-muted size-5 shrink-0 transition-transform',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div className="pb-3 pl-11 text-sm">
                  <ol className="list-decimal space-y-1 pl-4">
                    {e.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  {e.tip && <p className="text-muted mt-2">{e.tip}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <Link to={`/exercises?routine=${routine}`} className="text-accent block text-sm font-medium">
        {t('exercises.openFull')}
      </Link>
    </div>
  )
}
