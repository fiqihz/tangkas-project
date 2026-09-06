"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeProfileStats,
  type ProfileStats,
  type ResolvedMatch,
} from "@/lib/domain/roster-stats";
import { useAuthStore } from "@/lib/store/auth-store";
import * as repo from "@/lib/supabase/repo";
import type { DbPlayerProfile } from "@/lib/supabase/types";

/**
 * Muat data statistik lintas-mabar: daftar profil roster + semua match yang
 * sudah di-resolve ke profile_id, lalu hitung ProfileStats per profil.
 *
 * `matches` (ResolvedMatch[]) juga dikembalikan mentah agar UI bisa menghitung
 * head-to-head / partner secara on-demand saat sebuah profil dibuka.
 */
export function useRosterStats() {
  // Statistik lintas-mabar di-scope per community aktif. Dibaca reaktif agar
  // data dimuat ulang saat community aktif berubah (Req 8.4).
  const activeCommunityId = useAuthStore((s) => s.activeCommunityId);
  const [profiles, setProfiles] = useState<DbPlayerProfile[]>([]);
  const [matches, setMatches] = useState<ResolvedMatch[]>([]);
  const [statsById, setStatsById] = useState<Map<string, ProfileStats>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Tanpa community aktif tidak ada data untuk dihitung: kosongkan state
    // dan hentikan loading tanpa memanggil repo dengan null.
    if (!activeCommunityId) {
      setProfiles([]);
      setMatches([]);
      setStatsById(new Map());
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profs, resolved] = await Promise.all([
        repo.listProfiles(activeCommunityId),
        repo.listResolvedMatches(activeCommunityId),
      ]);
      setProfiles(profs);
      setMatches(resolved);
      setStatsById(computeProfileStats(resolved));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeCommunityId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { profiles, matches, statsById, loading, error, reload: load };
}
