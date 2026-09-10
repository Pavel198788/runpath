/* eslint-disable react-refresh/only-export-components -- файл конфигурации маршрутов */
import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'

// Экраны грузятся лениво — каждый маршрут отдельным чанком.
const TodayPage = lazy(() => import('@/features/today/TodayPage'))
const PlanPage = lazy(() => import('@/features/plan/PlanPage'))
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'))
const MorePage = lazy(() => import('@/features/more/MorePage'))
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'))
const WorkoutPage = lazy(() => import('@/features/workout/WorkoutPage'))
const TimerPage = lazy(() => import('@/features/workout/TimerPage'))
const LogWorkoutPage = lazy(() => import('@/features/workout/LogWorkoutPage'))
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'))
const LogDetailPage = lazy(() => import('@/features/history/LogDetailPage'))
const ImportPage = lazy(() => import('@/features/import/ImportPage'))
const FreeRunPage = lazy(() => import('@/features/tracking/FreeRunPage'))
const NutritionPage = lazy(() => import('@/features/nutrition/NutritionPage'))
const RecipesPage = lazy(() => import('@/features/nutrition/RecipesPage'))
const RaceDayPage = lazy(() => import('@/features/nutrition/RaceDayPage'))
const ProfilePage = lazy(() => import('@/features/more/ProfilePage'))

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
        { path: '*', element: <Navigate to="/today" replace /> },
      ],
    },
    // Таймер — без нижней навигации, на весь экран.
    { path: '/workout/:id/timer', element: <TimerPage /> },
    { path: '/run', element: <FreeRunPage /> },
  ],
  // На GitHub Pages приложение живёт в подпапке — basename берём из base сборки.
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
)
