import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardText, CardTitle } from '@/ui'
import type { Plan, PlanAdjustment } from '@/data/entities'
import { applyAdjustment, dismissAdjustment, evaluatePlan } from '@/data/services/adaptationService'

/** Предложение скорректировать план по итогам прошедших недель. */
export function AdaptationCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation()
  const [proposal, setProposal] = useState<PlanAdjustment | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    void evaluatePlan(plan).then((p) => {
      if (alive) setProposal(p)
    })
    return () => {
      alive = false
    }
    // Оцениваем один раз при открытии экрана; план меняется только через это же предложение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.lastEvaluatedWeekIndex])

  if (done) {
    return (
      <Card>
        <CardText className="text-success">{t('adapt.applied')}</CardText>
      </Card>
    )
  }
  if (!proposal) return null

  const weeksAdded =
    proposal.sourceWeeks.length + Math.max(0, proposal.reviewedWeek + 1 - proposal.continueFrom)

  return (
    <Card className="border-accent space-y-3">
      <CardTitle>{t('adapt.title')}</CardTitle>
      <CardText>{t(`adapt.reason.${proposal.reason}`)}</CardText>
      <CardText className="text-sm">
        {t('adapt.effect', { weeks: t('common.weeks', { count: weeksAdded }) })}
      </CardText>
      <div className="flex gap-2">
        <Button
          fullWidth
          onClick={() => {
            void applyAdjustment(proposal).then(() => setDone(true))
          }}
        >
          {t('adapt.apply')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void dismissAdjustment(proposal).then(() => setProposal(null))
          }}
        >
          {t('adapt.dismiss')}
        </Button>
      </div>
    </Card>
  )
}
