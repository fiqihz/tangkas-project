import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gabung className dengan aman (Tailwind-aware). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ubah nama jadi Title Case: huruf pertama tiap kata kapital, sisanya kecil.
 * Contoh: "yoona" -> "Yoona", "rizky pede" -> "Rizky Pede", "ADE" -> "Ade".
 * Merapikan juga spasi berlebih. Dipakai saat menyimpan & menampilkan nama
 * pemain agar konsisten, tak peduli bagaimana host mengetiknya.
 */
export function toTitleCase(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}
