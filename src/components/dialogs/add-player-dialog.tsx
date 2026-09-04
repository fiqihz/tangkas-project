"use client";

import { useMemo, useState } from "react";
import { Check, Search, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { GenderSelect, GenderBadge } from "@/components/ui/gender-select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import type { Gender, Level } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
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
  const { profiles, create: createProfile, remove: removeProfile } =
    useProfiles();
  const t = useT();
  const [tab, setTab] = useState<Tab>("roster");

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">{t("addPlayer.title")}</SheetTitle>

        {/* Tab switcher */}
        <div className="mt-3 flex gap-1 rounded-xl bg-secondary p-1">
          <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>
            {t("addPlayer.fromRoster")}
          </TabBtn>
          <TabBtn active={tab === "new"} onClick={() => setTab("new")}>
            {t("addPlayer.newPlayer")}
          </TabBtn>
        </div>

        {tab === "roster" ? (
          <RosterTab
            profiles={profiles}
            existingNames={existingNames}
            onAdd={addPlayer}
            onDeleteProfile={removeProfile}
            onClose={onClose}
          />
        ) : (
          <NewPlayerTab
            existingNames={existingNames}
            onCreate={async (name, level, gender) => {
              let profileId: string | null = null;
              try {
                const created = await createProfile(name, level, gender);
                profileId = created.id;
              } catch {
                // nama mungkin sudah ada di roster — tetap tambah ke sesi
              }
              await addPlayer({
                name,
                level,
                gender,
                profileId,
                status: "registered",
              });
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
  onDeleteProfile,
  onClose,
}: {
  profiles: DbPlayerProfile[];
  existingNames: Set<string>;
  onAdd: (p: {
    name: string;
    level: Level | null;
    gender?: Gender | null;
    profileId?: string | null;
    status?: "registered";
  }) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Profil roster yang menunggu konfirmasi hapus (null = tak ada).
  const [confirmDelete, setConfirmDelete] = useState<DbPlayerProfile | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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
        // Bawa gender dari roster agar tidak perlu di-set ulang tiap mabar.
        gender: p.gender,
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
          placeholder={t("addPlayer.searchRoster")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
        {available.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("addPlayer.rosterEmpty")}
          </p>
        )}
        {available.length > 0 && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("addPlayer.noMatch")} &quot;{query}&quot;
          </p>
        )}
        {filtered.map((p) => {
          const picked = selected.has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "flex min-h-[52px] items-center gap-1 rounded-xl border pr-1 transition-all",
                picked
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card",
              )}
            >
              <button
                onClick={() => toggle(p.id)}
                className="flex min-w-0 flex-1 select-none items-center justify-between gap-2 px-3 py-2 text-left transition-all active:scale-[0.98]"
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
                    <div className="flex items-center gap-1.5 truncate font-medium">
                      {p.name} <GenderBadge gender={p.gender} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      🏸 {t("addPlayer.sessionsPlayed", { n: p.sessions_played })}
                    </div>
                  </div>
                </div>
                <LevelBadge level={p.level} className="shrink-0" />
              </button>
              <button
                onClick={() => {
                  haptic(10);
                  setConfirmDelete(p);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground active:scale-90 active:bg-destructive/10 active:text-destructive"
                aria-label={t("addPlayer.deleteAria", { name: p.name })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <Button
        size="lg"
        onClick={addSelected}
        disabled={selected.size === 0 || saving}
      >
        {saving
          ? t("addPlayer.adding")
          : selected.size > 0
            ? t("addPlayer.addN", { n: selected.size })
            : t("addPlayer.pickFirst")}
      </Button>

      {confirmDelete && (
        <Sheet
          open
          onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}
        >
          <SheetContent>
            <SheetTitle className="text-lg font-bold">
              {t("addPlayer.deleteTitle", { name: confirmDelete.name })}
            </SheetTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("addPlayer.deleteBody")}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting}
                onClick={async () => {
                  if (deleting) return;
                  haptic(15);
                  setDeleting(true);
                  try {
                    await onDeleteProfile(confirmDelete.id);
                    // buang dari pilihan bila sempat terpilih
                    setSelected((s) => {
                      const next = new Set(s);
                      next.delete(confirmDelete.id);
                      return next;
                    });
                    setConfirmDelete(null);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? t("addPlayer.deleting") : t("common.delete")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function NewPlayerTab({
  existingNames,
  onCreate,
  onClose,
}: {
  existingNames: Set<string>;
  onCreate: (
    name: string,
    level: Level | null,
    gender: Gender | null,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);

  const dup = existingNames.has(name.trim().toLowerCase());
  const canSave = name.trim().length > 0 && !dup;

  const save = async () => {
    if (!canSave) return;
    haptic(15);
    setSaving(true);
    await onCreate(name.trim(), level, gender);
    setSaving(false);
    onClose();
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">{t("addPlayer.playerName")}</label>
        <Input
          placeholder={t("addPlayer.playerName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {dup && (
          <p className="mt-1 text-xs text-destructive">
            {t("addPlayer.dupName")}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          {t("addPlayer.levelHint")}
        </div>
        <LevelSelect value={level} onChange={setLevel} size="sm" />
      </div>

      <div>
        <div className="mb-1 text-xs text-muted-foreground">
          {t("addPlayer.genderHint")}
        </div>
        <GenderSelect value={gender} onChange={setGender} size="sm" />
      </div>

      <Button size="lg" onClick={save} disabled={!canSave || saving}>
        <UserPlus size={18} />
        {saving ? t("addPlayer.adding") : t("addPlayer.submit")}
      </Button>
    </div>
  );
}
