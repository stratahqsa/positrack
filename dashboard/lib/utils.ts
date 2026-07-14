import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner used across all components. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
