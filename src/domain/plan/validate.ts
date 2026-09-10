import type { PlanCore } from './types'

export interface SafetyIssue {
  weekIndex: number
  rule: 'growth' | 'long_share' | 'long_cap' | 'recovery_missing'
  detail: string
}

/**
 * Независимая проверка правил безопасности готового плана. Используется в тестах
 * и при применении предложений ИИ (этап A5): любое изменение плана проходит через неё.
 */
export function validatePlanSafety(plan: PlanCore): SafetyIssue[] {
  const issues: SafetyIssue[] = []
  let lastNormal: (typeof plan.weeks)[number] | null = null
  let sinceRecovery = 0

  for (const week of plan.weeks) {
    const samePhase = lastNormal && lastNormal.phase === week.phase && lastNormal.unit === week.unit
    const isBase = week.phase === 'walk' || week.phase === 'base' // прогрессия задана таблицей, а не процентом
    // Допуск на округление: минуты округляем до 5, км — до 0,5.
    const tolerance = week.unit === 'min' ? 2.6 : 0.26

    if (
      samePhase &&
      !isBase &&
      lastNormal &&
      !week.isRecovery &&
      !week.isTaper &&
      week.volume > lastNormal.volume * 1.1 + tolerance
    ) {
      issues.push({
        weekIndex: week.index,
        rule: 'growth',
        detail: `объём ${week.volume} > ${lastNormal.volume} × 1,1`,
      })
    }

    const isRace = week.isRace
    const shareCap = week.phase === 'marathon' ? 0.5 : week.phase === 'half' ? 0.4 : 0.36
    if (!isBase && !isRace && week.volume > 0 && week.longRun / week.volume > shareCap + 0.02) {
      issues.push({
        weekIndex: week.index,
        rule: 'long_share',
        detail: `длительная ${week.longRun} из ${week.volume}`,
      })
    }
    if (week.unit === 'km' && week.longRun > 32 && !isRace) {
      issues.push({
        weekIndex: week.index,
        rule: 'long_cap',
        detail: `длительная ${week.longRun} км`,
      })
    }

    // В объёмных фазах разгрузка не реже чем каждая 5-я неделя (4 рабочих подряд максимум).
    if (week.phase !== 'walk' && week.phase !== 'base') {
      sinceRecovery = week.isRecovery || week.isTaper ? 0 : sinceRecovery + 1
      if (sinceRecovery > 4) {
        issues.push({
          weekIndex: week.index,
          rule: 'recovery_missing',
          detail: '5 рабочих недель подряд',
        })
        sinceRecovery = 0
      }
    }

    if (!week.isRecovery && !week.isTaper) lastNormal = week
  }
  return issues
}
