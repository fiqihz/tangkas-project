// ============================================================================
// POST /api/share-image — render gambar hasil mabar (PNG) via next/og.
// ============================================================================
// Keamanan:
//   * Wajib login: header `Authorization: Bearer <access_token Supabase>`
//     diverifikasi ke Supabase Auth. Tanpa ini endpoint bisa dipakai siapa pun
//     untuk membuat gambar bermerek TangkasBoard dengan teks sembarang dan
//     menghabiskan kuota fungsi Vercel.
//   * Server TIDAK membaca data mabar dari DB; ia hanya merender payload dari
//     client (yang sudah divalidasi & dipotong panjangnya di
//     parseShareImagePayload). Jadi RLS tidak perlu dilonggarkan.
// ============================================================================
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { parseShareImagePayload, SHARE_IMAGE_SIZE } from "@/lib/share-image";
import { ShareCard } from "./share-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

type Assets = {
  spaceGrotesk: Buffer;
  interRegular: Buffer;
  interSemiBold: Buffer;
  logoSrc: string;
};

let assetsPromise: Promise<Assets> | null = null;

/** Muat font + logo sekali per instance fungsi (di-cache di memori). */
function loadAssets(): Promise<Assets> {
  if (!assetsPromise) {
    const root = process.cwd();
    assetsPromise = Promise.all([
      readFile(join(root, "asset/fonts/SpaceGrotesk-Bold.woff")),
      readFile(join(root, "asset/fonts/Inter-Regular.woff")),
      readFile(join(root, "asset/fonts/Inter-SemiBold.woff")),
      readFile(join(root, "public/shuttlecock.png")),
    ])
      .then(([spaceGrotesk, interRegular, interSemiBold, logo]) => ({
        spaceGrotesk,
        interRegular,
        interSemiBold,
        logoSrc: `data:image/png;base64,${logo.toString("base64")}`,
      }))
      .catch((e) => {
        // Jangan cache kegagalan: percobaan berikutnya boleh baca ulang.
        assetsPromise = null;
        throw e;
      });
  }
  return assetsPromise;
}

async function isAuthenticated(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function POST(req: Request): Promise<Response> {
  if (!(await isAuthenticated(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const data = parseShareImagePayload(raw);
  if (!data) {
    return new Response("Invalid payload", { status: 400 });
  }

  let assets: Assets;
  try {
    assets = await loadAssets();
  } catch (e) {
    console.error("share-image: gagal memuat aset", e);
    return new Response("Server not configured", { status: 500 });
  }

  const { width, height } = SHARE_IMAGE_SIZE[data.format];
  const host = new URL(req.url).host;

  return new ImageResponse(
    <ShareCard data={data} logoSrc={assets.logoSrc} host={host} />,
    {
      width,
      height,
      fonts: [
        { name: "Space Grotesk", data: assets.spaceGrotesk, weight: 700, style: "normal" },
        { name: "Inter", data: assets.interRegular, weight: 400, style: "normal" },
        { name: "Inter", data: assets.interSemiBold, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
