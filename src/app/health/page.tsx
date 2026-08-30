"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { DEFAULT_COMMUNITY_ID } from "@/lib/supabase/types";

type CheckState = "pending" | "ok" | "fail";

interface Check {
  label: string;
  state: CheckState;
  detail?: string;
}

const TABLES = [
  "community",
  "player_profile",
  "session",
  "session_player",
  "court",
  "match",
];

export default function HealthPage() {
  const [checks, setChecks] = useState<Check[]>([]);

  useEffect(() => {
    void runChecks(setChecks);
  }, []);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">🩺 Diagnostik Supabase</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Halaman ini mengecek koneksi ke database. Bisa dihapus nanti.
      </p>

      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span className="text-lg leading-none">
              {c.state === "ok" ? "✅" : c.state === "fail" ? "❌" : "⏳"}
            </span>
            <div>
              <div className="font-medium">{c.label}</div>
              {c.detail && (
                <div className="text-xs text-muted-foreground break-all">
                  {c.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {checks.length > 0 && checks.every((c) => c.state === "ok") && (
        <div className="mt-6 rounded-lg bg-primary/10 p-4 text-center font-semibold text-primary">
          🎉 Semua cek lolos — Supabase tersambung dengan benar!
        </div>
      )}
    </main>
  );
}

async function runChecks(setChecks: (c: Check[]) => void) {
  const results: Check[] = [];
  const push = (c: Check) => {
    results.push(c);
    setChecks([...results]);
  };

  // 1. Env terisi
  if (!isSupabaseConfigured()) {
    push({
      label: "Environment variables",
      state: "fail",
      detail:
        "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum terbaca. Pastikan .env terisi lalu RESTART `npm run dev`.",
    });
    return;
  }
  push({
    label: "Environment variables",
    state: "ok",
    detail: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  // 2. Konek + komunitas default ada
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("community")
      .select("id, name")
      .eq("id", DEFAULT_COMMUNITY_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      push({
        label: "Komunitas default",
        state: "fail",
        detail:
          "Tabel 'community' terbaca tapi baris default tidak ada. Jalankan ulang schema.sql.",
      });
    } else {
      push({
        label: "Koneksi & komunitas default",
        state: "ok",
        detail: `Ditemukan: "${data.name}"`,
      });
    }
  } catch (e) {
    push({
      label: "Koneksi ke Supabase",
      state: "fail",
      detail: describeError(e),
    });
    return;
  }

  // 3. Semua tabel bisa di-query
  for (const table of TABLES) {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from(table).select("*").limit(1);
      if (error) throw error;
      push({ label: `Tabel "${table}"`, state: "ok" });
    } catch (e) {
      push({
        label: `Tabel "${table}"`,
        state: "fail",
        detail: describeError(e),
      });
    }
  }
}

function describeError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
