import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { Card, CardText, Page, PageHeader } from '@/ui'
import { EXERCISES, ROUTINES } from '@content/index'
import type { Exercise } from '@content/schemas'
import { cn } from '@/lib/cn'
import { ExerciseIcon } from './ExerciseIcon'

const CATEGORIES: Exercise['category'][] = ['warmup', 'cooldown', 'stretch', 'strength', 'mobility']

/** Библиотека упражнений: готовые наборы (routine=...) или вся библиотека по категориям. */
export default function ExercisesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const routine = params.get('routine')
  const [category, setCategory] = useState<Exercise['category'] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const routineIds = routine ? (ROUTINES[routine] ?? []) : null
  const list = routineIds
    ? routineIds.map((id) => EXERCISES.find((e) => e.id === id)).filter((e): e is Exercise => !!e)
    : EXERCISES.filter((e) => !category || e.category === category)

  return (
    <Page className="space-y-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-muted flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </button>
      <PageHeader title={routine ? t(`exercises.routine.${routine}`) : t('exercises.title')} />
      {!routine && <CardText className="text-sm">{t('exercises.hint')}</CardText>}

      <div className="flex flex-wrap gap-2">
        {Object.keys(ROUTINES).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={routine === r}
            onClick={() => setParams(routine === r ? {} : { routine: r })}
            className={cn(
              'min-h-10 rounded-full border px-3 text-sm',
              routine === r ? 'border-accent bg-accent/10 font-medium' : 'border-border',
            )}
          >
            {t(`exercises.routine.${r}`)}
          </button>
        ))}
      </div>
      {!routine && (
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                'min-h-9 rounded-full border px-3 text-xs',
                category === c ? 'border-accent bg-accent/10 font-medium' : 'border-border',
              )}
            >
              {t(`exercises.category.${c}`)}
            </button>
          ))}
        </div>
      )}

      {list.map((e, i) => {
        const isOpen = open === e.id
        return (
          <Card key={e.id} className="space-y-2">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : e.id)}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="text-accent shrink-0">
                <ExerciseIcon icon={e.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {routine ? `${i + 1}. ` : ''}
                  {e.name}
                </span>
                <span className="text-muted block text-sm">
                  {e.duration} · {t(`exercises.category.${e.category}`)}
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
              <div className="space-y-2 text-sm">
                <p className="text-muted">
                  {t('exercises.target')}: {e.target}
                </p>
                <ol className="list-decimal space-y-1 pl-5">
                  {e.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                {e.tip && (
                  <p className="bg-surface-2 rounded-lg p-2">
                    <span className="font-medium">{t('exercises.tip')}: </span>
                    {e.tip}
                  </p>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </Page>
  )
}
