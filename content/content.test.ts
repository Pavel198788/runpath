import { describe, expect, it } from 'vitest'
import { CHALLENGES, EXERCISES, GLOSSARY, LESSONS, MILESTONES, ROUTINES, SYMPTOMS } from './index'
import {
  ChallengeSchema,
  ExerciseSchema,
  GlossarySchema,
  LessonSchema,
  MilestoneSchema,
  RoutinesSchema,
  SymptomSchema,
} from './schemas'

describe('контент', () => {
  it('упражнения и наборы', () => {
    for (const e of EXERCISES) expect(ExerciseSchema.safeParse(e).success, e.name).toBe(true)
    expect(RoutinesSchema.safeParse(ROUTINES).success).toBe(true)
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(ids.size).toBe(EXERCISES.length)
    for (const list of Object.values(ROUTINES))
      for (const id of list) expect(ids.has(id), id).toBe(true)
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40)
  })
  it('симптомы, глоссарий, уроки, вехи', () => {
    for (const s of SYMPTOMS) expect(SymptomSchema.safeParse(s).success, s.id).toBe(true)
    for (const g of GLOSSARY) expect(GlossarySchema.safeParse(g).success, g.id).toBe(true)
    const terms = new Set(GLOSSARY.map((g) => g.id))
    for (const l of LESSONS) {
      expect(LessonSchema.safeParse(l).success, l.id).toBe(true)
      for (const t of l.terms) expect(terms.has(t), `${l.id}: ${t}`).toBe(true)
    }
    for (const m of MILESTONES) expect(MilestoneSchema.safeParse(m).success).toBe(true)
    for (const c of CHALLENGES) expect(ChallengeSchema.safeParse(c).success).toBe(true)
    expect(LESSONS.length).toBeGreaterThanOrEqual(12)
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30)
  })
})
