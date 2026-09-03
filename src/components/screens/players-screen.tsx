"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock,
  Coffee,
  LogIn,
  LogOut,
  Play,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/ui/level-badge";
import { LevelSelect } from "@/components/ui/level-select";
import { GenderSelect, GenderBadge } from "@/components/ui/gender-select";
import { Fab } from "@/components/ui/fab";
import type { Gender, Level, PlayerStatus, SessionPlayer } from "@/lib/domain/types";
import { sortByQueuePriority } from "@/lib/domain/queue";
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

/** Asumsi durasi rata-rata satu match (menit) untuk estimasi giliran. */
const ASSUMED_MATCH_MINUTES = 12;

/**
 * Info antrian per pemain active untuk ditampilkan sebagai badge:
 *  - playing: sedang main di lapangan
 *  - waiting: menunggu, dengan nomor urut (1-based) & estimasi menit
 */
type QueueInfo =
  | { kind: "playing" }
  | { kind: "waiting"; position: number; etaMinutes: number };

export function PlayersScreen() {
  const { players, matches, courts, setPlayerLevel, setPlayerStatus, setPlayerGender } =
    useSessionStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  // Group status yang di-collapse (disembunyikan isinya). Default semua terbuka.
  const [collapsed, setCollapsed] = useState<Set<PlayerStatus>>(new Set());

  const toggleGroup = (status: PlayerStatus) => {
    haptic(6);
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

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

  // Peta info antrian per pemain active: siapa sedang main & siapa menunggu
  // (dengan nomor urut + estimasi menit). Dihitung dari SEMUA pemain agar
  // urutan konsisten walau sedang di-search.
  const queueInfo = useMemo(() => {
    // Pemain yang sedang di match berjalan (playing) = "sedang main".
    const playingIds = new Set<string>();
    for (const m of matches) {
      if (m.state === "playing") {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          playingIds.add(id),
        );
      }
    }
    // Pemain di preview proposed juga sudah dialokasikan (tidak dihitung
    // sebagai "menunggu" agar estimasi tidak dobel).
    const proposedIds = new Set<string>();
    for (const m of matches) {
      if (m.state === "proposed") {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          proposedIds.add(id),
        );
      }
    }

    const map = new Map<string, QueueInfo>();
    for (const id of playingIds) map.set(id, { kind: "playing" });

    // Antrian menunggu = active, tidak sedang main / proposed.
    const waiting = players.filter(
      (p) =>
        p.status === "active" && !playingIds.has(p.id) && !proposedIds.has(p.id),
    );
    const ordered = sortByQueuePriority(waiting);
    const courtCount = Math.max(1, courts.length);
    ordered.forEach((p, idx) => {
      const position = idx + 1; // 1-based
      // Berapa "gelombang" match sebelum giliran pemain ini.
      const wave = Math.ceil(position / courtCount);
      map.set(p.id, {
        kind: "waiting",
        position,
        etaMinutes: wave * ASSUMED_MATCH_MINUTES,
      });
    });
    return map;
  }, [players, matches, courts]);

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
        (status) => {
          if (grouped[status].length === 0) return null;
          const isCollapsed = collapsed.has(status);
          return (
            <div key={status}>
              <button
                onClick={() => toggleGroup(status)}
                className="mb-2 flex w-full select-none items-center gap-2 text-sm font-medium active:opacity-70"
                aria-expanded={!isCollapsed}
              >
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
                <ChevronDown
                  size={16}
                  className={cn(
                    "ml-auto text-muted-foreground transition-transform",
                    isCollapsed && "-rotate-90",
                  )}
                />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-2">
                  {orderForDisplay(status, grouped[status], queueInfo).map(
                    (p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        queue={
                          status === "active" ? queueInfo.get(p.id) : undefined
                        }
                        expanded={expanded === p.id}
                        onToggle={() =>
                          setExpanded(expanded === p.id ? null : p.id)
                        }
                        onSetLevel={(lv) => setPlayerLevel(p.id, lv)}
                        onSetGender={(g) => setPlayerGender(p.id, g)}
                        onSetStatus={(s) => setPlayerStatus(p.id, s)}
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          );
        },
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
  queue,
  expanded,
  onToggle,
  onSetLevel,
  onSetGender,
  onSetStatus,
}: {
  player: SessionPlayer;
  queue?: QueueInfo;
  expanded: boolean;
  onToggle: () => void;
  onSetLevel: (lv: Level) => void;
  onSetGender: (g: Gender) => void;
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
          className="flex min-h-[44px] w-full select-none items-center justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{player.name}</span>
            <LevelBadge level={player.level} />
            <GenderBadge gender={player.gender} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {queue && <QueueBadge queue={queue} />}
            <span className="text-xs text-muted-foreground">
              {player.gamesPlayed}x
            </span>
          </div>
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
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                Set gender {player.gender === null && "(belum di-set)"}
              </div>
              <GenderSelect
                value={player.gender}
                onChange={onSetGender}
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

/**
 * Urutan tampil per grup. Untuk grup "active", tampilkan pemain yang SEDANG
 * MAIN dulu, lalu pemain menunggu sesuai nomor antrian. Grup lain apa adanya.
 */
function orderForDisplay(
  status: PlayerStatus,
  list: SessionPlayer[],
  queueInfo: Map<string, QueueInfo>,
): SessionPlayer[] {
  if (status !== "active") return list;
  const rank = (p: SessionPlayer) => {
    const q = queueInfo.get(p.id);
    if (!q) return Number.MAX_SAFE_INTEGER; // proposed/tak terklasifikasi -> paling akhir
    if (q.kind === "playing") return -1; // sedang main paling atas
    return q.position; // menunggu: sesuai nomor antrian
  };
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

/** Badge status antrian: "Main" (sedang main) atau "#N · ~M mnt" (menunggu). */
function QueueBadge({ queue }: { queue: QueueInfo }) {
  if (queue.kind === "playing") {
    return (
      <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
        <Play size={11} /> Main
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      <Clock size={11} />#{queue.position} · ~{queue.etaMinutes}m
    </span>
  );
}
