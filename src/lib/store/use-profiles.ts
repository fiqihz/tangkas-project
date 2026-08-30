"use client";

import { useCallback, useEffect, useState } from "react";
import type { Level } from "@/lib/domain/types";
import * as repo from "@/lib/supabase/repo";
import type { DbPlayerProfile } from "@/lib/supabase/types";

/** Hook untuk mengelola roster (player_profile) yang persisten. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<DbPlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await repo.listProfiles());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load awal roster dari Supabase (async — setState terjadi setelah await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const create = useCallback(
    async (name: string, level: Level | null) => {
      const created = await repo.createProfile(name, level);
      await load();
      return created;
    },
    [load],
  );

  const update = useCallback(
    async (id: string, patch: { name?: string; level?: Level | null }) => {
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
