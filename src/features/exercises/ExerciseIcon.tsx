import type { Exercise } from '@content/schemas'

/** Простые схемы-пиктограммы для категорий упражнений (без видео — всё офлайн). */
export function ExerciseIcon({
  icon,
  className = 'size-10',
}: {
  icon: Exercise['icon']
  className?: string
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const paths: Record<Exercise['icon'], React.ReactNode> = {
    walk: (
      <path
        d="M20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M14 14l2-4 3 1 2 3M16 10l-3 5-1 7M13 15l3 3 1 6"
        transform="translate(-6 0)"
      />
    ),
    run: (
      <path
        d="M22 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0M8 20l4-6 4 2 2-5-3-2-4 3-4-2M12 14l-2 5-4 1M16 16l3 4"
        transform="translate(-4 0)"
      />
    ),
    arms: (
      <path d="M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 8v8M8 12h8M9 22l3-6 3 6M6 8l3 3M18 8l-3 3" />
    ),
    leg: <path d="M10 3a2 2 0 1 1 4 0 2 2 0 0 1-4 0M12 5v7M12 12l-4 9M12 12l6 4-2 5" />,
    lunge: <path d="M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 7v6M12 13l-5 4v4M12 13l5 3 2 5M7 17h-3" />,
    calf: <path d="M10 3v10l-2 8M10 13l4 2 1 6M8 21h8M14 3v10" />,
    hips: (
      <path d="M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 7v5M7 12h10M12 12l-4 9M12 12l4 9M6 9l6 3 6-3" />
    ),
    breath: (
      <path d="M12 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 8v6M8 12l4 2 4-2M6 17c2 2 10 2 12 0M4 20c3 2 13 2 16 0" />
    ),
    bridge: (
      <path
        d="M3 18h18M5 18l4-6h6l4 6M9 12l-2-3M15 12l2-3M19 9a2 2 0 1 1 4 0 2 2 0 0 1-4 0"
        transform="translate(-2 0)"
      />
    ),
    squat: (
      <path d="M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 7v5M12 12l-5 3 2 6M12 12l5 3-2 6M7 15h10" />
    ),
    plank: <path d="M3 17h18M4 17l3-5h11l3 5M7 12v-2a2 2 0 1 1 4 0v2M18 12l-3-1" />,
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...common}>
      {paths[icon]}
    </svg>
  )
}
