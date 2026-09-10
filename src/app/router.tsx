/* eslint-disable react-refresh/only-export-components -- файл конфигурации маршрутов */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Suspense } from 'react'
import { lazyWithRetry } from './lazyWithRetry'
import { ErrorBoundary } from './ErrorBoundary'
import { AppShell } from './layout/AppShell'

// Экраны грузятся лениво — каждый маршрут отдельным чанком.
const TodayPage = lazyWithRetry(() => import('@/features/today/TodayPage'))
const PlanPage = lazyWithRetry(() => import('@/features/plan/PlanPage'))
const ProgressPage = lazyWithRetry(() => import('@/features/progress/ProgressPage'))
const MorePage = lazyWithRetry(() => import('@/features/more/MorePage'))
const OnboardingPage = lazyWithRetry(() => import('@/features/onboarding/OnboardingPage'))
const WorkoutPage = lazyWithRetry(() => import('@/features/workout/WorkoutPage'))
const TimerPage = lazyWithRetry(() => import('@/features/workout/TimerPage'))
const LogWorkoutPage = lazyWithRetry(() => import('@/features/workout/LogWorkoutPage'))
const HistoryPage = lazyWithRetry(() => import('@/features/history/HistoryPage'))
const LogDetailPage = lazyWithRetry(() => import('@/features/history/LogDetailPage'))
const ImportPage = lazyWithRetry(() => import('@/features/import/ImportPage'))
const FreeRunPage = lazyWithRetry(() => import('@/features/tracking/FreeRunPage'))
const NutritionPage = lazyWithRetry(() => import('@/features/nutrition/NutritionPage'))
const RecipesPage = lazyWithRetry(() => import('@/features/nutrition/RecipesPage'))
const RaceDayPage = lazyWithRetry(() => import('@/features/nutrition/RaceDayPage'))
const ProfilePage = lazyWithRetry(() => import('@/features/more/ProfilePage'))
const ExercisesPage = lazyWithRetry(() => import('@/features/exercises/ExercisesPage'))
const InjuryPage = lazyWithRetry(() => import('@/features/injury/InjuryPage'))
const LearnPage = lazyWithRetry(() => import('@/features/learn/LearnPage'))
const LessonPage = lazyWithRetry(() => import('@/features/learn/LessonPage'))
const CalculatorsPage = lazyWithRetry(() => import('@/features/calc/CalculatorsPage'))
const ShoesPage = lazyWithRetry(() => import('@/features/shoes/ShoesPage'))
const ChallengesPage = lazyWithRetry(() => import('@/features/gamification/ChallengesPage'))
const CoachPage = lazyWithRetry(() => import('@/features/coach/CoachPage'))
const LevelTestPage = lazyWithRetry(() => import('@/features/leveltest/LevelTestPage'))
const AccountPage = lazyWithRetry(() => import('@/features/account/AccountPage'))

/** Полноэкранный маршрут: своя обёртка загрузки и перехвата ошибок. */
function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<p className="text-muted p-6 text-center">Загрузка…</p>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/today" replace /> },
        { path: '/today', element: <TodayPage /> },
        { path: '/plan', element: <PlanPage /> },
        { path: '/progress', element: <ProgressPage /> },
        { path: '/more', element: <MorePage /> },
        { path: '/onboarding', element: <OnboardingPage /> },
        { path: '/workout/:id', element: <WorkoutPage /> },
        { path: '/log/new', element: <LogWorkoutPage /> },
        { path: '/history', element: <HistoryPage /> },
        { path: '/history/:id', element: <LogDetailPage /> },
        { path: '/import', element: <ImportPage /> },
        { path: '/nutrition', element: <NutritionPage /> },
        { path: '/nutrition/recipes', element: <RecipesPage /> },
        { path: '/nutrition/race', element: <RaceDayPage /> },
        { path: '/profile', element: <ProfilePage /> },
        { path: '/exercises', element: <ExercisesPage /> },
        { path: '/injury', element: <InjuryPage /> },
        { path: '/learn', element: <LearnPage /> },
        { path: '/learn/:id', element: <LessonPage /> },
        { path: '/calc', element: <CalculatorsPage /> },
        { path: '/shoes', element: <ShoesPage /> },
        { path: '/challenges', element: <ChallengesPage /> },
        { path: '/coach', element: <CoachPage /> },
        { path: '/leveltest', element: <LevelTestPage /> },
        { path: '/account', element: <AccountPage /> },
        { path: '*', element: <Navigate to="/today" replace /> },
      ],
    },
    // Таймер и свободная пробежка — на весь экран, без нижней навигации.
    // Своя обёртка Suspense обязательна: они вне AppShell.
    { path: '/workout/:id/timer', element: <FullScreen>{<TimerPage />}</FullScreen> },
    { path: '/run', element: <FullScreen>{<FreeRunPage />}</FullScreen> },
  ],
  // На GitHub Pages приложение живёт в подпапке — basename берём из base сборки.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
