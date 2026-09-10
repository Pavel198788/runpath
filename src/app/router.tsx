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

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: '/today', element: <TodayPage /> },
      { path: '/plan', element: <PlanPage /> },
      { path: '/progress', element: <ProgressPage /> },
      { path: '/more', element: <MorePage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
])
