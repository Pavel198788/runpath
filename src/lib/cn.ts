import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Склеивает классы Tailwind без конфликтов (последний побеждает). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
