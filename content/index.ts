import exercisesJson from './exercises/exercises.json'
import routinesJson from './exercises/routines.json'
import symptomsJson from './injury/symptoms.json'
import glossaryJson from './learn/glossary.json'
import lessonsJson from './learn/lessons.json'
import milestonesJson from './gamification/milestones.json'
import challengesJson from './gamification/challenges.json'
import type {
  ChallengeTemplate,
  Exercise,
  GlossaryTerm,
  Lesson,
  Milestone,
  Symptom,
} from './schemas'

export const EXERCISES = exercisesJson as Exercise[]
export const ROUTINES = routinesJson as Record<string, string[]>
export const SYMPTOMS = symptomsJson as Symptom[]
export const GLOSSARY = glossaryJson as GlossaryTerm[]
export const LESSONS = lessonsJson as Lesson[]
export const MILESTONES = milestonesJson as Milestone[]
export const CHALLENGES = challengesJson as ChallengeTemplate[]
