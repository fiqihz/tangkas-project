"use client";

import { useCallback, useEffect, useState } from "react";
import type { Gender, Level } from "@/lib/domain/types";
import { useAuthStore } from "@/lib/store/auth-store";
import * as repo from "@/lib/supabase/repo";
import type { DbPlayerProfile } from "@/lib/supabase/types";

/** Hook untuk mengelola roster (player_profile) yang persisten. */
export function useProfiles() {
  // Roster di-scope per community aktif. Dibaca reaktif agar data dimuat ulang
  // saat community aktif berubah (Req 8.4).
  const activeCommunityId = useAuthStore((s) => s.activeCommunityId);
  const [profiles, setProfiles] = useState<DbPlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Tanpa community aktif tidak ada roster untuk dimuat: kosongkan state
    // dan hentikan loading tanpa memanggil repo dengan null.
    if (!activeCommunityId) {
      setProfiles([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setProfiles(await repo.listProfiles(activeCommunityId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeCommunityId]);

  useEffect(() => {
    // Load awal roster dari Supabase (async — setState terjadi setelah await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const create = useCallback(
    async (name: string, level: Level | null, gender: Gender | null = null) => {
      // create hanya dipanggil dari UI roster yang aktif ketika ada community,
      // jadi guard null cukup melempar error yang jelas ketimbang diam-diam gagal.
      if (!activeCommunityId) throw new Error("Belum ada community aktif.");
      const created = await repo.createProfile(
        name,
        level,
        gender,
        activeCommunityId,
      );
      await load();
      return created;
    },
    [load, activeCommunityId],
  );

  const update = useCallback(
    async (
      id: string,
      patch: { name?: string; level?: Level | null; gender?: Gender | null },
    ) => {
      await repo.updateProfile(id, patch);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.deleteProfile(id);
      await load();
    },
    [load],
  );

  return { profiles, loading, error, reload: load, create, update, remove };
}
