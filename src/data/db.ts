import Dexie, { type EntityTable } from 'dexie'
import type {
  Achievement,
  AiConversation,
  Challenge,
  NutritionDay,
  Shoe,
  Plan,
  PlanAdjustment,
  Settings,
  Track,
  UserProfile,
  WellnessEntry,
  Workout,
  WorkoutLog,
} from './entities'

/**
 * Локальная база (IndexedDB через Dexie). Единственный источник истины.
 *
 * ПРАВИЛА МИГРАЦИЙ (не ломать!):
 * - Никогда не редактировать уже выпущенную версию: только добавлять
 *   `this.version(N + 1).stores({...}).upgrade(...)`.
 * - В stores() перечисляются ТОЛЬКО индексы, а не все поля.
 * - У каждой таблицы обязательно индексы `updatedAt` и `deletedAt` —
 *   на них опирается синхронизация (этап B).
 */
export class RunPathDB extends Dexie {
  profiles!: EntityTable<UserProfile, 'id'>
  settings!: EntityTable<Settings, 'id'>
  plans!: EntityTable<Plan, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutLogs!: EntityTable<WorkoutLog, 'id'>
  tracks!: EntityTable<Track, 'id'>
  wellness!: EntityTable<WellnessEntry, 'id'>
  planAdjustments!: EntityTable<PlanAdjustment, 'id'>
  nutritionDays!: EntityTable<NutritionDay, 'id'>
  shoes!: EntityTable<Shoe, 'id'>
  achievements!: EntityTable<Achievement, 'id'>
  challenges!: EntityTable<Challenge, 'id'>
  aiConversations!: EntityTable<AiConversation, 'id'>

  constructor(name = 'runpath') {
    super(name)

    this.version(1).stores({
      profiles: 'id, updatedAt, deletedAt',
      settings: 'id, updatedAt, deletedAt',
    })

    // v2 (A1): план, тренировки и журнал.
    this.version(2).stores({
      profiles: 'id, updatedAt, deletedAt',
      settings: 'id, updatedAt, deletedAt',
      plans: 'id, isActive, updatedAt, deletedAt',
      workouts: 'id, planId, date, weekIndex, updatedAt, deletedAt',
      workoutLogs: 'id, workoutId, date, updatedAt, deletedAt',
    })

    // v3 (A2): GPS-треки, самочувствие, корректировки плана; новые поля у записей и плана.
    this.version(3)
      .stores({
        profiles: 'id, updatedAt, deletedAt',
        settings: 'id, updatedAt, deletedAt',
        plans: 'id, isActive, updatedAt, deletedAt',
        workouts: 'id, planId, date, weekIndex, updatedAt, deletedAt',
        workoutLogs: 'id, workoutId, date, externalId, updatedAt, deletedAt',
        tracks: 'id, logId, updatedAt, deletedAt',
        wellness: 'id, date, updatedAt, deletedAt',
        planAdjustments: 'id, planId, status, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('workoutLogs')
          .toCollection()
          .modify((log: Partial<WorkoutLog>) => {
            log.startTime ??= null
            log.avgHr ??= null
            log.elevationGainM ??= null
            log.splits ??= []
            log.trackId ??= null
            log.externalId ??= null
            log.name ??= null
          })
        await tx
          .table('plans')
          .toCollection()
          .modify((plan: Partial<Plan>) => {
            plan.lastEvaluatedWeekIndex ??= -1
          })
        await tx
          .table('settings')
          .toCollection()
          .modify((s: Partial<Settings>) => {
            s.gpsEnabled ??= true
            s.autoPause ??= true
            s.remindersEnabled ??= false
            s.reminderTime ??= '18:00'
          })
      })

    // v4 (A3): дневник питания; цель по весу в профиле.
    this.version(4)
      .stores({
        profiles: 'id, updatedAt, deletedAt',
        settings: 'id, updatedAt, deletedAt',
        plans: 'id, isActive, updatedAt, deletedAt',
        workouts: 'id, planId, date, weekIndex, updatedAt, deletedAt',
        workoutLogs: 'id, workoutId, date, externalId, updatedAt, deletedAt',
        tracks: 'id, logId, updatedAt, deletedAt',
        wellness: 'id, date, updatedAt, deletedAt',
        planAdjustments: 'id, planId, status, updatedAt, deletedAt',
        nutritionDays: 'id, date, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('profiles')
          .toCollection()
          .modify((p: Partial<UserProfile>) => {
            p.weightGoal ??= 'none'
          })
      })

    // v5 (A4): обувь, достижения, челленджи; shoeId у записи.
    this.version(5)
      .stores({
        profiles: 'id, updatedAt, deletedAt',
        settings: 'id, updatedAt, deletedAt',
        plans: 'id, isActive, updatedAt, deletedAt',
        workouts: 'id, planId, date, weekIndex, updatedAt, deletedAt',
        workoutLogs: 'id, workoutId, date, externalId, shoeId, updatedAt, deletedAt',
        tracks: 'id, logId, updatedAt, deletedAt',
        wellness: 'id, date, updatedAt, deletedAt',
        planAdjustments: 'id, planId, status, updatedAt, deletedAt',
        nutritionDays: 'id, date, updatedAt, deletedAt',
        shoes: 'id, updatedAt, deletedAt',
        achievements: 'id, key, updatedAt, deletedAt',
        challenges: 'id, status, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('workoutLogs')
          .toCollection()
          .modify((l: Partial<WorkoutLog>) => {
            l.shoeId ??= null
          })
      })

    // v6 (A5): диалоги с ИИ-тренером; настройки BYOK.
    this.version(6)
      .stores({
        profiles: 'id, updatedAt, deletedAt',
        settings: 'id, updatedAt, deletedAt',
        plans: 'id, isActive, updatedAt, deletedAt',
        workouts: 'id, planId, date, weekIndex, updatedAt, deletedAt',
        workoutLogs: 'id, workoutId, date, externalId, shoeId, updatedAt, deletedAt',
        tracks: 'id, logId, updatedAt, deletedAt',
        wellness: 'id, date, updatedAt, deletedAt',
        planAdjustments: 'id, planId, status, updatedAt, deletedAt',
        nutritionDays: 'id, date, updatedAt, deletedAt',
        shoes: 'id, updatedAt, deletedAt',
        achievements: 'id, key, updatedAt, deletedAt',
        challenges: 'id, status, updatedAt, deletedAt',
        aiConversations: 'id, updatedAt, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('settings')
          .toCollection()
          .modify((s: Partial<Settings>) => {
            s.aiProvider ??= null
            s.aiApiKey ??= null
            s.aiBaseUrl ??= ''
            s.aiModel ??= ''
          })
      })
  }
}

export const db = new RunPathDB()

/** Полностью стирает локальные данные (кнопка «Удалить все данные»). */
export async function wipeDatabase() {
  await db.delete()
  await db.open()
}
