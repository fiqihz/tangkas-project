import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gabung className dengan aman (Tailwind-aware). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
