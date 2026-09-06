// ============================================================================
// Invite link & email payload builders (fungsi murni, app-side)
// ----------------------------------------------------------------------------
// Modul ini adalah SATU SUMBER KEBENARAN untuk kontrak format tautan undangan
// `${APP_URL}/register?invite=${token}` beserta subjek/HTML email undangan.
//
// Edge Function Deno `supabase/functions/send-invite/index.ts` berjalan di
// runtime terpisah (Deno) sehingga tidak dapat mengimpor modul TS aplikasi ini.
// Logika kecil di sini sengaja MENDUPLIKASI kontrak yang dipakai Edge Function
// agar dapat diuji oleh test runner Vitest tanpa menjalankan Deno. Bila kontrak
// tautan berubah, ubah di kedua tempat dan jaga tetap selaras.
// ============================================================================

/**
 * Bentuk tautan pendaftaran undangan.
 *
 * Menghasilkan `${appUrl-tanpa-trailing-slash}/register?invite=${token}`,
 * persis seperti yang disusun Edge Function `send-invite`.
 *
 * @param appUrl origin aplikasi, boleh dengan atau tanpa trailing slash.
 * @param token token undangan unik dari baris `invite`.
 */
export function buildInviteUrl(appUrl: string, token: string): string {
  const origin = appUrl.replace(/\/+$/, "");
  return `${origin}/register?invite=${token}`;
}

/**
 * Subjek email undangan admin community. Konstan (tanpa interpolasi) dan
 * selaras dengan Edge Function `send-invite`.
 */
export function buildInviteSubject(): string {
  return "[TangkasBoard] Undangan menjadi admin community";
}

export interface InviteEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

/** Escape karakter HTML agar aman disisipkan ke markup email. */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface BuildInviteEmailArgs {
  from: string;
  email: string;
  appUrl: string;
  token: string;
}

/**
 * Susun body payload email undangan (bentuk yang dikirim ke Resend).
 * Menyisipkan tautan undangan (di-escape) ke dalam HTML dan mengembalikan
 * struktur `{ from, to, subject, html }`.
 */
export function buildInviteEmailPayload(
  args: BuildInviteEmailArgs,
): InviteEmailPayload {
  const url = buildInviteUrl(args.appUrl, args.token);
  const safeUrl = escapeHtml(url);
  const subject = buildInviteSubject();

  const html = `<a href="${safeUrl}">${safeUrl}</a>`;

  return {
    from: args.from,
    to: [args.email],
    subject,
    html,
  };
}
