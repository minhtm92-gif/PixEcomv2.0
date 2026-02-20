import { clsx, type ClassValue } from 'clsx';

/** Merge Tailwind classes without conflicts */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
