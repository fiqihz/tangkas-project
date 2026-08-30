"use client";

import { useMemo, useState } from "react";
import { LogIn, Coffee, LogOut, Play, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { Fab } from "@/components/ui/fab";
import type { Level, PlayerStatus, SessionPlayer } from "@/lib/domain/types";
import { useSessionStore } from "@/lib/store/session-store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { AddPlayerDialog } from "@/components/dialogs/add-player-dialog";

const STATUS_LABEL: Record<PlayerStatus, string> = {
  registered: "Belum check-in",
  active: "Main (Active)",
  resting: "Istirahat",
  left: "Pulang",
};

export function PlayersScreen() {
  const { players, setPlayerLevel, setPlayerStatus } = useSessionStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const existingNames = useMemo(
    () => new Set(players.map((p) => p.name.toLowerCase())),
    [players],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, query]);

  const grouped = groupByStatus(filtered);

  return (
    <div className="flex flex-col gap-5">
      {players.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada pemain. Tap tombol{" "}
          <span className="font-medium text-foreground">+ Pemain</span> untuk
          menambah dari roster atau buat pemain baru.
        </div>
      )}

      {players.length > 0 && (
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
      )}

      {players.length > 0 && filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Tidak ada pemain cocok dengan &quot;{query}&quot;.
        </p>
      )}

      {(["active", "registered", "resting", "left"] as PlayerStatus[]).map(
        (status) =>
          grouped[status].length > 0 && (
            <div key={status}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    status === "active" && "bg-primary",
                    status === "registered" && "bg-muted-foreground",
                    status === "resting" && "bg-amber-500",
                    status === "left" && "bg-destructive",
                  )}
                />
                {STATUS_LABEL[status]} ({grouped[status].length})
              </div>
              <div className="flex flex-col gap-2">
                {grouped[status].map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    expanded={expanded === p.id}
                    onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                    onSetLevel={(lv) => setPlayerLevel(p.id, lv)}
                    onSetStatus={(s) => setPlayerStatus(p.id, s)}
                  />
                ))}
              </div>
            </div>
          ),
      )}

      <Fab
        onClick={() => setAdding(true)}
        icon={<Plus size={22} />}
        label="Pemain"
      />

      {adding && (
        <AddPlayerDialog
          existingNames={existingNames}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function PlayerRow({
  player,
  expanded,
  onToggle,
  onSetLevel,
  onSetStatus,
}: {
  player: SessionPlayer;
  expanded: boolean;
  onToggle: () => void;
  onSetLevel: (lv: Level) => void;
  onSetStatus: (s: PlayerStatus) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-3">
        <button
          onClick={() => {
            haptic(6);
            onToggle();
          }}
          className="flex min-h-[44px] w-full select-none items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{player.name}</span>
            <LevelBadge level={player.level} />
          </div>
          <span className="text-xs text-muted-foreground">
            {player.gamesPlayed}x main
          </span>
        </button>

        {expanded && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                Set level
              </div>
              <LevelSelect
                value={player.level}
                onChange={onSetLevel}
                size="sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {player.status !== "active" && (
                <Button size="sm" onClick={() => onSetStatus("active")}>
                  <LogIn size={14} /> Check-in / Aktif
                </Button>
              )}
              {player.status === "active" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSetStatus("resting")}
                >
                  <Coffee size={14} /> Istirahat
                </Button>
              )}
              {player.status !== "left" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onSetStatus("left")}
                >
                  <LogOut size={14} /> Pulang
                </Button>
              )}
              {player.status === "resting" && (
                <Button size="sm" onClick={() => onSetStatus("active")}>
                  <Play size={14} /> Main lagi
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function groupByStatus(players: SessionPlayer[]) {
  const g: Record<PlayerStatus, SessionPlayer[]> = {
    registered: [],
    active: [],
    resting: [],
    left: [],
  };
  for (const p of players) g[p.status].push(p);
  // Active diurutkan berdasarkan urutan check-in (first come first play).
  g.active.sort((a, b) => {
    const at = a.checkedInAt ?? "";
    const bt = b.checkedInAt ?? "";
    if (at !== bt) return at.localeCompare(bt);
    return a.name.localeCompare(b.name);
  });
  return g;
}
