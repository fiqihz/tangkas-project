/**
 * Validasi murni untuk form auth (login & register). Tidak ada I/O maupun
 * dependensi React sehingga mudah diuji dan dipakai ulang di komponen.
 *
 * _Requirements: 1.4_ — form login/register memvalidasi input sebelum submit.
 * _Design: Testing Strategy → Unit & integration_
 */

/**
 * Format email dianggap valid bila memenuhi pola sederhana
 * `local@domain.tld` tanpa spasi. Sengaja longgar (bukan RFC penuh):
 * cukup untuk mencegah submit input yang jelas bukan email.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** Panjang minimum password yang diterima form. */
export const MIN_PASSWORD_LENGTH = 6;

/** Password valid bila memenuhi panjang minimum (tanpa dipangkas). */
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/**
 * Apakah kredensial email/password layak dikirim (tombol submit aktif).
 * Kosong / email tak valid / password terlalu pendek → tidak boleh submit.
 */
export function isCredentialsSubmittable(email: string, password: string): boolean {
  return isValidEmail(email) && isValidPassword(password);
}
