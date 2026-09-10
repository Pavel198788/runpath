import { z } from 'zod'

/** Схемы остального контента (упражнения, уроки, глоссарий, симптомы, вехи). */
export const ExerciseSchema = z.object({
  id: z.string(),
  category: z.enum(['warmup', 'cooldown', 'stretch', 'strength', 'mobility']),
  name: z.string().min(2),
  target: z.string(),
  duration: z.string(),
  steps: z.array(z.string().min(1)).min(1),
  tip: z.string(),
  icon: z.enum([
    'walk',
    'arms',
    'leg',
    'lunge',
    'calf',
    'run',
    'hips',
    'breath',
    'bridge',
    'squat',
    'plank',
  ]),
})

export const RoutinesSchema = z.record(z.string(), z.array(z.string()))

export const SymptomSchema = z.object({
  id: z.string(),
  area: z.enum(['knee', 'shin', 'achilles', 'foot', 'calf', 'hip', 'back', 'chest', 'other']),
  title: z.string(),
  causes: z.array(z.string()).min(1),
  doNow: z.array(z.string()).min(1),
  seeDoctor: z.array(z.string()).min(1),
})

export const GlossarySchema = z.object({
  id: z.string(),
  term: z.string(),
  short: z.string(),
  long: z.string(),
})

export const LessonSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  phase: z.enum(['walk', 'base', 'k5', 'k10', 'half', 'marathon', 'any']),
  title: z.string(),
  minutes: z.number().int(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), text: z.string() })).min(1),
  terms: z.array(z.string()),
})

export const MilestoneSchema = z.object({ km: z.number(), text: z.string() })
export const ChallengeSchema = z.object({
  id: z.string(),
  name: z.string(),
  km: z.number(),
  days: z.number().int(),
  text: z.string(),
})

export type Exercise = z.infer<typeof ExerciseSchema>
export type Symptom = z.infer<typeof SymptomSchema>
export type GlossaryTerm = z.infer<typeof GlossarySchema>
export type Lesson = z.infer<typeof LessonSchema>
export type Milestone = z.infer<typeof MilestoneSchema>
export type ChallengeTemplate = z.infer<typeof ChallengeSchema>
