"use client";

import { useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Level } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useProfiles } from "@/lib/store/use-profiles";
import type { DbPlayerProfile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Tab = "roster" | "new";

/**
 * Bottom sheet gabungan untuk menambah pemain ke sesi:
 *  - Tab "Roster": cari & pilih (multi-select) pemain tersimpan.
 *  - Tab "Baru": buat pemain baru (nama + level) sekaligus simpan ke roster.
 */
export function AddPlayerDialog({
  existingNames,
  onClose,
}: {
  existingNames: Set<string>;
  onClose: () => void;
}) {
  const { addPlayer } = useSessionStore();
  const { profiles, create: createProfile } = useProfiles();
  const [tab, setTab] = useState<Tab>("roster");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">Tambah Pemain</SheetTitle>

        {/* Tab switcher */}
        <div className="mt-3 flex gap-1 rounded-xl bg-secondary p-1">
          <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>
            Dari Roster
          </TabBtn>
          <TabBtn active={tab === "new"} onClick={() => setTab("new")}>
            Pemain Baru
          </TabBtn>
        </div>

        {tab === "roster" ? (
          <RosterTab
            profiles={profiles}
            existingNames={existingNames}
            onAdd={addPlayer}
            onClose={onClose}
          />
        ) : (
          <NewPlayerTab
            existingNames={existingNames}
            onCreate={async (name, level) => {
              let profileId: string | null = null;
              try {
                const created = await createProfile(name, level);
                profileId = created.id;
              } catch {
                // nama mungkin sudah ada di roster — tetap tambah ke sesi
              }
              await addPlayer({ name, level, profileId, status: "registered" });
            }}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        haptic(6);
        onClick();
      }}
      className={cn(
        "min-h-[40px] flex-1 select-none rounded-lg text-sm font-medium transition-all active:scale-[0.98]",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RosterTab({
  profiles,
  existingNames,
  onAdd,
  onClose,
}: {
  profiles: DbPlayerProfile[];
  existingNames: Set<string>;
  onAdd: (p: {
    name: string;
    level: Level | null;
    profileId?: string | null;
    status?: "registered";
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const available = useMemo(
    () => profiles.filter((p) => !existingNames.has(p.name.toLowerCase())),
    [profiles, existingNames],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((p) => p.name.toLowerCase().includes(q));
  }, [available, query]);

  const toggle = (id: string) => {
    haptic(6);
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    haptic(15);
    setSaving(true);
    const chosen = available.filter((p) => selected.has(p.id));
    for (const p of chosen) {
      await onAdd({
        name: p.name,
        level: p.level,
        profileId: p.id,
        status: "registered",
      });
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Cari nama pemain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
        {available.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Semua pemain roster sudah ditambahkan, atau roster masih kosong.
          </p>
        )}
        {available.length > 0 && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tidak ada yang cocok dengan &quot;{query}&quot;.
          </p>
        )}
        {filtered.map((p) => {
          const picked = selected.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              className={cn(
                "flex min-h-[52px] select-none items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.98]",
                picked
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card active:bg-secondary",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    picked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {picked && <Check size={14} />}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    🏸 {p.sessions_played}x mabar
                  </div>
                </div>
              </div>
              <LevelBadge level={p.level} className="shrink-0" />
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        onClick={addSelected}
        disabled={selected.size === 0 || saving}
      >
        {saving
          ? "Menambahkan…"
          : selected.size > 0
            ? `Tambah ${selected.size} pemain`
            : "Pilih pemain dulu"}
      </Button>
    </div>
  );
}

function NewPlayerTab({
  existingNames,
  onCreate,
  onClose,
}: {
  existingNames: Set<string>;
  onCreate: (name: string, level: Level | null) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [saving, setSaving] = useState(false);

  const dup = existingNames.has(name.trim().toLowerCase());
  const canSave = name.trim().length > 0 && !dup;

  const save = async () => {
    if (!canSave) return;
    haptic(15);
    setSaving(true);
    await onCreate(name.trim(), level);
    setSaving(false);
    onClose();
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Nama pemain</label>
        <Input
          placeholder="Nama pemain"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {dup && (
          <p className="mt-1 text-xs text-destructive">
            Nama ini sudah ada di sesi.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          Level (opsional — bisa di-set nanti saat observasi)
        </div>
        <LevelSelect value={level} onChange={setLevel} size="sm" />
      </div>

      <Button size="lg" onClick={save} disabled={!canSave || saving}>
        <UserPlus size={18} />
        {saving ? "Menambahkan…" : "Tambah pemain"}
      </Button>
    </div>
  );
}
