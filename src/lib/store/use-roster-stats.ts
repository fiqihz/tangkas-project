"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeProfileStats,
  type ProfileStats,
  type ResolvedMatch,
} from "@/lib/domain/roster-stats";
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
  const [profiles, setProfiles] = useState<DbPlayerProfile[]>([]);
  const [matches, setMatches] = useState<ResolvedMatch[]>([]);
  const [statsById, setStatsById] = useState<Map<string, ProfileStats>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profs, resolved] = await Promise.all([
        repo.listProfiles(),
        repo.listResolvedMatches(),
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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { profiles, matches, statsById, loading, error, reload: load };
}
