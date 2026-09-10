import type { BaseEntity } from './base'

export type Sex = 'male' | 'female' | 'other'

/** Стартовый уровень активности — калибрует первую фазу плана. */
export type ActivityLevel =
  | 'never_ran' // никогда не бегал, мало хожу
  | 'walk_30' // могу пройти 30 минут
  | 'run_walk' // чередую бег и ходьбу
  | 'run_5k' // бегаю 5 км
  | 'run_10k' // бегаю 10 км

export type Goal = 'start_running' | 'half_marathon' | 'marathon'

/** Ограничения здоровья: влияют на консервативность плана и дисклеймеры. */
export type HealthFlag =
  'joints' | 'back' | 'cardio' | 'overweight' | 'pregnancy' | 'diabetes' | 'asthma' | 'other'

/** 0 = понедельник … 6 = воскресенье (как в date-fns с weekStartsOn: 1). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface UserProfile extends BaseEntity {
  birthYear: number | null
  sex: Sex | null
  heightCm: number | null
  weightKg: number | null
  activityLevel: ActivityLevel
  goal: Goal
  /** Желаемая дата старта (ISO-дата без времени) или null — «сколько нужно». */
  targetDate: string | null
  healthFlags: HealthFlag[]
  availableDays: Weekday[]
  preferredTime: 'morning' | 'day' | 'evening' | null
  /** Самая длинная пробежка за последний месяц, км (у тех, кто уже бегает). */
  longestRunKm: number | null
  /** Сколько раз в неделю бегает сейчас. */
  runsPerWeek: number | null
  /** Максимальный пульс, если известен; иначе оценка по возрасту. */
  maxHr: number | null
  /** Цель по весу: мягкий дефицит только при 'lose'. */
  weightGoal: 'lose' | 'maintain' | 'none'
  /** Когда пользователь принял медицинский дисклеймер. */
  disclaimerAcceptedAt: string | null
  onboardingCompletedAt: string | null
}
