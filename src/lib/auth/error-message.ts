/**
 * Deteksi apakah pesan error dari Supabase berupa rate-limit ("security
 * purposes" / "you can only request this after N seconds"). Dipakai halaman
 * login & register untuk menampilkan pesan ramah (t("auth.rateLimited"))
 * alih-alih teks Inggris mentah dari Supabase.
 */
export function isRateLimitError(message: string | undefined | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("you can only request this after") ||
    lower.includes("for security purposes")
  );
}
