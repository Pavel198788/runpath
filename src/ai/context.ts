import { db } from '@/data/db'
import { getProfile } from '@/data/repositories/profileRepo'
import { getActivePlan } from '@/data/repositories/planRepo'
import { addDaysIso, mondayOf, toIsoDate, todayIso } from '@/domain/dates/dates'

/**
 * Структурированный контекст для тренера: профиль, текущая и следующая неделя плана,
 * последние 4 недели журнала, самочувствие. Только то, что нужно; без имён и ключей.
 */
export async function buildCoachContext(): Promise<string> {
  const today = todayIso()
  const profile = await getProfile()
  const plan = await getActivePlan()
  const monday = toIsoDate(mondayOf(new Date(today)))
  const lines: string[] = ['КОНТЕКСТ', `Сегодня: ${today}`]

  if (profile) {
    const age = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null
    lines.push(
      `Профиль: возраст ${age ?? '?'}, пол ${profile.sex ?? '?'}, вес ${profile.weightKg ?? '?'} кг, стартовый уровень ${profile.activityLevel}, цель ${profile.goal}, особенности здоровья: ${profile.healthFlags.join(', ') || 'нет'}, цель по весу ${profile.weightGoal}.`,
    )
  }
  if (plan) {
    const week = plan.weeks.find((w) => today >= w.startDate && today < addDaysIso(w.startDate, 7))
    lines.push(
      `План: старт ${plan.startDate}, финиш ${plan.endDate}, ${plan.weeks.length} недель, фазы: ${plan.phases.map((p) => `${p.phase} (нед. ${p.fromWeek + 1}–${p.toWeek + 1})`).join(', ')}.`,
    )
    if (week) {
      lines.push(
        `Текущая неделя ${week.index + 1}: фаза ${week.phase}, объём ${week.volume} ${week.unit}, длительная ${week.longRun}${week.isRecovery ? ', разгрузочная' : ''}${week.isTaper ? ', тейпер' : ''}.`,
      )
    }
    const from = monday
    const to = addDaysIso(monday, 13)
    const workouts = await db.workouts
      .where('date')
      .between(from, to, true, true)
      .filter((w) => w.planId === plan.id && w.deletedAt === null)
      .sortBy('date')
    lines.push('Тренировки этой и следующей недели (id | дата | тип | минуты | км | статус):')
    for (const w of workouts) {
      lines.push(
        `- ${w.id} | ${w.date} | ${w.type} | ${Math.round(w.estimatedSeconds / 60)} | ${w.targetDistanceM ? (w.targetDistanceM / 1000).toFixed(1) : '-'} | ${w.status}`,
      )
    }
  } else lines.push('Плана нет.')

  const logs = await db.workoutLogs
    .where('date')
    .between(addDaysIso(today, -28), today, true, true)
    .filter((l) => l.deletedAt === null)
    .sortBy('date')
  lines.push(
    `Журнал за 4 недели (${logs.length} записей; дата | тип | мин | км | RPE | самочувствие | боли):`,
  )
  for (const l of logs.slice(-30)) {
    lines.push(
      `- ${l.date} | ${l.type} | ${Math.round(l.durationSec / 60)} | ${l.distanceM ? (l.distanceM / 1000).toFixed(1) : '-'} | ${l.rpe ?? '-'} | ${l.feeling ?? '-'} | ${l.pains.join(',') || '-'}`,
    )
  }
  const wellness = await db.wellness
    .where('date')
    .between(addDaysIso(today, -7), today, true, true)
    .filter((w) => w.deletedAt === null)
    .toArray()
  if (wellness.length) {
    lines.push('Самочувствие за неделю (дата | сон | стресс | пульс покоя | болел):')
    for (const w of wellness)
      lines.push(
        `- ${w.date} | ${w.sleepHours ?? '-'} | ${w.stress ?? '-'} | ${w.restingHr ?? '-'} | ${w.sick ? 'да' : 'нет'}`,
      )
  }
  return lines.join('\n')
}
