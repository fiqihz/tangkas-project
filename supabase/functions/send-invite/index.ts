// ============================================================================
// Edge Function: send-invite
// ----------------------------------------------------------------------------
// Dipicu oleh trigger DB `trg_notify_invite` (migration 014) via `net.http_post`
// saat ada baris baru di tabel `invite` (event INSERT). Mengirim email undangan
// menjadi admin community lewat Resend, berisi tautan pendaftaran
// `${APP_URL}/register?invite=${token}`.
//
// Secret (di-set via `supabase secrets set`, TIDAK di-hardcode di kode):
//   RESEND_API_KEY   — API key Resend (format re_xxx)
//   INVITE_FROM       — alamat pengirim (default: "TangkasBoard <onboarding@resend.dev>")
//   APP_URL           — origin aplikasi (mis. https://tangkas-project.vercel.app)
//   WEBHOOK_SECRET    — (opsional) token untuk memverifikasi pemanggil webhook
//
// Deploy:
//   supabase functions deploy send-invite --no-verify-jwt
//
// KETERBATASAN (bukan bug): dengan pengirim default `onboarding@resend.dev`,
// email hanya sampai ke pemilik akun Resend. Untuk mengirim undangan ke email
// pihak ketiga, verifikasi domain di Resend lalu set `INVITE_FROM` ke alamat
// pada domain terverifikasi tersebut.
// ============================================================================

interface InviteRow {
  id: string;
  community_id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  expires_at: string;
  invited_by: string | null;
  created_at: string;
}

// Payload webhook dari trigger 014 (row_to_json(new) sebagai `record`).
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: InviteRow | null;
  old_record: InviteRow | null;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_APP_URL = "https://tangkas-project.vercel.app";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Verifikasi opsional: bila WEBHOOK_SECRET di-set, pemanggil harus mengirim
  // header yang cocok. Melindungi endpoint dari pemanggilan liar.
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const provided =
      req.headers.get("x-webhook-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("INVITE_FROM") ?? "TangkasBoard <onboarding@resend.dev>";
  const appUrl = (Deno.env.get("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, "");

  if (!apiKey) {
    console.error("Missing RESEND_API_KEY env.");
    return new Response("Server not configured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Hanya proses INSERT ke tabel invite.
  if (payload.type !== "INSERT" || payload.table !== "invite") {
    return new Response("Ignored", { status: 200 });
  }

  const row = payload.record;
  if (!row?.email || !row.token) {
    return new Response("No record", { status: 200 });
  }

  // Tautan undangan harus persis cocok dengan halaman register + redeem.
  // Kontrak format link ini diselaraskan dengan `src/lib/invite/invite-link.ts`
  // (buildInviteUrl) yang menjadi sumber kebenaran & diuji unit test app-side.
  const url = `${appUrl}/register?invite=${row.token}`;

  const when = row.expires_at
    ? new Date(row.expires_at).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      })
    : "-";

  const safeUrl = escapeHtml(url);
  const safeWhen = escapeHtml(when);

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#16a34a; margin-bottom: 4px;">🏸 Undangan admin — TangkasBoard</h2>
      <p style="color:#0f172a; font-size:15px; margin-top:12px;">
        Halo! Kamu diundang untuk menjadi <strong>admin</strong> pada sebuah community di TangkasBoard.
        Klik tombol di bawah untuk mendaftar dan menerima undangan ini.
      </p>
      <div style="text-align:center; margin:24px 0;">
        <a href="${safeUrl}"
           style="display:inline-block; background:#16a34a; color:#ffffff; text-decoration:none; font-weight:600; padding:12px 24px; border-radius:12px;">
          Terima undangan &amp; daftar
        </a>
      </div>
      <p style="font-size:13px; color:#64748b;">
        Atau salin tautan berikut ke browser:<br />
        <a href="${safeUrl}" style="color:#16a34a; word-break:break-all;">${safeUrl}</a>
      </p>
      <p style="font-size:13px; color:#64748b;">Undangan berlaku sampai: ${safeWhen} WIB</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;" />
      <p style="font-size:13px; color:#94a3b8;">
        EN: You've been invited to become an <strong>admin</strong> on a TangkasBoard community.
        Open the link above to register and accept the invitation. This invite expires at ${safeWhen} (WIB).
      </p>
    </div>
  `;

  const subject = "[TangkasBoard] Undangan menjadi admin community";

  const emailBody: Record<string, unknown> = {
    from,
    to: [row.email],
    subject,
    html,
  };

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailBody),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend error:", res.status, detail);
    return new Response(`Email failed: ${res.status}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
