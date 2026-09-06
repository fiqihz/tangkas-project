// ============================================================================
// Edge Function: notify-feedback
// ----------------------------------------------------------------------------
// Dipicu oleh Supabase Database Webhook saat ada baris baru di tabel `feedback`
// (event INSERT). Mengirim email notifikasi ke host lewat Resend.
//
// Secret (di-set via `supabase secrets set`, TIDAK di-hardcode di kode):
//   RESEND_API_KEY   — API key Resend (format re_xxx)
//   FEEDBACK_TO       — email tujuan (mis. fiqihz096@gmail.com)
//   FEEDBACK_FROM     — alamat pengirim (default: onboarding@resend.dev)
//   WEBHOOK_SECRET    — (opsional) token untuk memverifikasi pemanggil webhook
//
// Deploy:
//   supabase functions deploy notify-feedback --no-verify-jwt
// ============================================================================

interface FeedbackRow {
  id: string;
  message: string;
  contact: string | null;
  created_at: string;
}

// Payload standar Supabase Database Webhook untuk event tabel.
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: FeedbackRow | null;
  old_record: FeedbackRow | null;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

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
  const to = Deno.env.get("FEEDBACK_TO");
  const from = Deno.env.get("FEEDBACK_FROM") ?? "TangkasBoard <onboarding@resend.dev>";

  if (!apiKey || !to) {
    console.error("Missing RESEND_API_KEY or FEEDBACK_TO env.");
    return new Response("Server not configured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Hanya proses INSERT ke tabel feedback.
  if (payload.type !== "INSERT" || payload.table !== "feedback") {
    return new Response("Ignored", { status: 200 });
  }

  const row = payload.record;
  if (!row?.message) {
    return new Response("No record", { status: 200 });
  }

  const contactLine = row.contact
    ? escapeHtml(row.contact)
    : "(tidak diisi / not provided)";
  const when = row.created_at
    ? new Date(row.created_at).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
      })
    : "-";

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#16a34a; margin-bottom: 4px;">🏸 Masukan baru — TangkasBoard</h2>
      <p style="color:#64748b; font-size:13px; margin-top:0;">Diterima: ${escapeHtml(when)} WIB</p>
      <div style="background:#f1f5f9; border-radius:12px; padding:16px; margin:16px 0;">
        <div style="font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Pesan</div>
        <div style="white-space:pre-wrap; color:#0f172a; margin-top:4px;">${escapeHtml(row.message)}</div>
      </div>
      <div style="font-size:14px; color:#0f172a;">
        <strong>Kontak:</strong> ${contactLine}
      </div>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;" />
      <p style="font-size:12px; color:#94a3b8;">ID: ${escapeHtml(row.id)}</p>
    </div>
  `;

  const subject = `[TangkasBoard] Masukan baru${
    row.contact ? ` dari ${row.contact}` : ""
  }`;

  const emailBody: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html,
  };
  // Bila kontak berupa email valid, set reply-to agar host bisa balas langsung.
  if (row.contact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.contact.trim())) {
    emailBody.reply_to = row.contact.trim();
  }

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
