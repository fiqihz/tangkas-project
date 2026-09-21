"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenderBadge } from "@/components/ui/gender-select";
import { LevelBadge } from "@/components/ui/level-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  buildExecutionPlan,
  defaultDecisions,
  parseImportText,
  planImport,
  summarize,
  type ImportPlan,
  type ImportRow,
  type ImportRowKind,
  type RowDecision,
  type SessionPlayerRef,
} from "@/lib/domain/import-players";
import type { PlayerProfile } from "@/lib/domain/types";
import { haptic } from "@/lib/haptics";
import type { DictKey } from "@/lib/i18n/dict";
import { useSessionStore } from "@/lib/store/session-store";
import { useT } from "@/lib/store/settings-store";
import { cn } from "@/lib/utils";

/**
 * Tab "Import": host menempel daftar nama (biasanya dari grup WhatsApp), lalu
 * mereview hasil pembacaannya sebelum dieksekusi.
 *
 * Dua langkah disengaja: import menulis ke roster permanen, jadi salah baca
 * lebih baik ditangkap di layar preview ketimbang dibersihkan satu-satu
 * sesudahnya. Baris hasil pencocokan fuzzy ditempatkan paling atas karena itu
 * satu-satunya kategori yang keputusannya tidak pasti.
 */
export function ImportPlayersTab({
  roster,
  sessionPlayers,
  onDone,
}: {
  roster: PlayerProfile[];
  sessionPlayers: SessionPlayerRef[];
  onDone: () => Promise<void> | void;
}) {
  const t = useT();
  const importPlayers = useSessionStore((s) => s.importPlayers);

  const [text, setText] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [decisions, setDecisions] = useState<Map<string, RowDecision>>(new Map());
  const [saving, setSaving] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Hitung jumlah nama sambil host mengetik/menempel, supaya tombol lanjut bisa
  // memberi tahu apa yang terbaca sebelum ditekan.
  const detected = useMemo(() => parseImportText(text).length, [text]);

  const review = () => {
    haptic(10);
    const next = planImport(text, { roster, sessionPlayers });
    setPlan(next);
    setDecisions(defaultDecisions(next));
  };

  const pasteFromClipboard = async () => {
    haptic(6);
    setPasteError(null);
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setPasteError(t("import.clipboardEmpty"));
        return;
      }
      // Sambung, bukan menimpa: host mungkin menempel dari beberapa pesan.
      setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${clip}` : clip));
    } catch {
      // Browser bisa menolak (butuh izin / bukan konteks aman). Tempel manual
      // tetap jalan, jadi cukup beri tahu.
      setPasteError(t("import.clipboardFailed"));
    }
  };

  const patch = (row: ImportRow, next: Partial<RowDecision>) => {
    setDecisions((prev) => {
      const current = prev.get(row.id);
      if (!current) return prev;
      const map = new Map(prev);
      map.set(row.id, { ...current, ...next });
      return map;
    });
  };

  const summary = useMemo(
    () => (plan ? summarize(plan, decisions) : null),
    [plan, decisions],
  );

  const submit = async () => {
    if (!plan || !summary) return;
    haptic(15);
    setSaving(true);
    const result = await importPlayers(buildExecutionPlan(plan, decisions));
    setSaving(false);
    // Gagal: pesan error sudah tampil lewat actionError global, dan preview
    // dibiarkan utuh supaya host bisa mencoba lagi tanpa menempel ulang.
    if (result.ok) await onDone();
  };

  // ---------------------------------------------------------------- langkah 1
  if (!plan) {
    return (
      <div className="mt-4 flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("import.hintFormat")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {t("import.hintPaid")}
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPasteError(null);
          }}
          placeholder={t("import.placeholder")}
          className="max-h-[34vh] font-mono text-sm"
          aria-label={t("import.textareaAria")}
        />

        <Button variant="outline" onClick={pasteFromClipboard}>
          <ClipboardPaste size={16} />
          {t("import.pasteFromClipboard")}
        </Button>

        {pasteError && (
          <p className="text-xs text-destructive" role="status">
            {pasteError}
          </p>
        )}

        <Button size="lg" onClick={review} disabled={detected === 0}>
          {detected === 0
            ? t("import.pasteFirst")
            : t("import.reviewN", { n: detected })}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- langkah 2
  const groups: { kind: ImportRowKind; rows: ImportRow[] }[] = (
    ["fuzzy", "new", "exact", "session", "duplicate"] as ImportRowKind[]
  )
    .map((kind) => ({ kind, rows: plan.rows.filter((r) => r.kind === kind) }))
    .filter((g) => g.rows.length > 0);

  const nothingToDo = summary!.toAdd === 0 && summary!.paidUpdates === 0;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <SummaryBar summary={summary!} />

      <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto">
        {groups.map((group) => (
          <section key={group.kind} className="flex flex-col gap-1.5">
            <GroupHeader kind={group.kind} count={group.rows.length} />
            {group.rows.map((row) => (
              <PreviewRow
                key={row.id}
                row={row}
                decision={decisions.get(row.id)}
                onPatch={(next) => patch(row, next)}
              />
            ))}
          </section>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => {
            haptic(6);
            setPlan(null);
          }}
          disabled={saving}
          aria-label={t("import.editText")}
        >
          <ArrowLeft size={16} />
          {t("import.editText")}
        </Button>
        <Button
          size="lg"
          className="flex-1"
          onClick={submit}
          disabled={saving || nothingToDo}
        >
          {saving
            ? t("import.importing")
            : nothingToDo
              ? t("import.nothingToAdd")
              : summary!.toAdd > 0
                ? t("import.submitN", { n: summary!.toAdd })
                : t("import.submitPaidOnly", { n: summary!.paidUpdates })}
        </Button>
      </div>
    </div>
  );
}

/** Ringkasan angka di atas daftar preview. */
function SummaryBar({
  summary,
}: {
  summary: ReturnType<typeof summarize>;
}) {
  const t = useT();
  const items: string[] = [];
  if (summary.linked > 0) items.push(t("import.sumLinked", { n: summary.linked }));
  if (summary.created > 0) items.push(t("import.sumCreated", { n: summary.created }));
  if (summary.paid > 0) items.push(t("import.sumPaid", { n: summary.paid }));

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-sm font-medium">
        {t("import.summaryTitle", { n: summary.toAdd })}
      </p>
      {items.length > 0 && (
        <p className="mt-0.5 text-xs text-muted-foreground">{items.join(" · ")}</p>
      )}
      {summary.needsReview > 0 && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="shrink-0" />
          {t("import.summaryReview", { n: summary.needsReview })}
        </p>
      )}
    </div>
  );
}

const GROUP_ICON: Record<ImportRowKind, React.ElementType> = {
  fuzzy: AlertTriangle,
  new: UserPlus,
  exact: Users,
  session: Check,
  duplicate: Copy,
};

const GROUP_TITLE: Record<ImportRowKind, DictKey> = {
  fuzzy: "import.groupFuzzy",
  new: "import.groupNew",
  exact: "import.groupExact",
  session: "import.groupSession",
  duplicate: "import.groupDuplicate",
};

const GROUP_HINT: Record<ImportRowKind, DictKey> = {
  fuzzy: "import.groupFuzzyHint",
  new: "import.groupNewHint",
  exact: "import.groupExactHint",
  session: "import.groupSessionHint",
  duplicate: "import.groupDuplicateHint",
};

function GroupHeader({ kind, count }: { kind: ImportRowKind; count: number }) {
  const t = useT();
  const Icon = GROUP_ICON[kind];
  return (
    <div className="mt-1 first:mt-0">
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold",
          kind === "fuzzy" ? "text-amber-600 dark:text-amber-400" : "text-foreground",
        )}
      >
        <Icon size={13} className="shrink-0" />
        {t(GROUP_TITLE[kind])} · {count}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {t(GROUP_HINT[kind])}
      </p>
    </div>
  );
}

function PreviewRow({
  row,
  decision,
  onPatch,
}: {
  row: ImportRow;
  decision: RowDecision | undefined;
  onPatch: (next: Partial<RowDecision>) => void;
}) {
  const t = useT();

  // Duplikat tidak punya keputusan: ditampilkan sekadar supaya host tahu
  // barisnya terbaca, bukan hilang diam-diam.
  if (!decision) {
    return (
      <div className="flex min-h-[40px] items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 opacity-60">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {row.line}
        </span>
        <span className="truncate text-sm line-through">{row.name}</span>
      </div>
    );
  }

  const linked = row.profileId !== null && (row.kind === "exact" || decision.linkProfile);
  const isSession = row.kind === "session";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2 transition-all",
        !decision.selected
          ? "border-border bg-card opacity-50"
          : row.kind === "fuzzy"
            ? "border-amber-500/60 bg-amber-500/5"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => {
            haptic(6);
            onPatch({ selected: !decision.selected });
          }}
          role="checkbox"
          aria-checked={decision.selected}
          aria-label={t("import.selectAria", { name: row.name })}
          className="shrink-0 transition-transform active:scale-90"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border",
              decision.selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border",
            )}
          >
            {decision.selected && <Check size={14} />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {linked || isSession ? row.name : row.typedName}
            </span>
            <GenderBadge gender={row.gender} />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">
              {t("import.lineNo", { n: row.line })}
            </span>
            {row.kind === "fuzzy" && row.similarity !== null && (
              <span className="text-amber-600 dark:text-amber-400">
                {t("import.typedAs", {
                  name: row.typedName,
                  percent: Math.round(row.similarity * 100),
                })}
              </span>
            )}
            {isSession && <span>{t("import.alreadyThere")}</span>}
          </div>
        </div>

        {!isSession && <LevelBadge level={row.level} className="shrink-0" />}

        <PaidPill
          paid={decision.paid}
          name={row.name}
          onToggle={() => {
            haptic(6);
            onPatch({ paid: !decision.paid });
          }}
        />
      </div>

      {/* Pilihan tautkan-atau-buat-baru hanya relevan untuk hasil fuzzy. */}
      {row.kind === "fuzzy" && decision.selected && (
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          <ChoiceBtn
            active={decision.linkProfile}
            onClick={() => onPatch({ linkProfile: true })}
          >
            {t("import.useSuggested", { name: row.name })}
          </ChoiceBtn>
          <ChoiceBtn
            active={!decision.linkProfile}
            onClick={() => onPatch({ linkProfile: false })}
          >
            {t("import.createNew", { name: row.typedName })}
          </ChoiceBtn>
        </div>
      )}
    </div>
  );
}

function PaidPill({
  paid,
  name,
  onToggle,
}: {
  paid: boolean;
  name: string;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paid}
      aria-label={t("import.paidAria", { name })}
      className={cn(
        "flex min-h-[32px] shrink-0 select-none items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-all active:scale-95",
        paid
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground",
      )}
    >
      {paid && <Check size={12} />}
      {paid ? t("import.paid") : t("import.unpaid")}
    </button>
  );
}

function ChoiceBtn({
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
      type="button"
      onClick={() => {
        haptic(6);
        onClick();
      }}
      aria-pressed={active}
      className={cn(
        "min-h-[34px] flex-1 select-none truncate rounded-md px-2 text-[11px] font-medium transition-all active:scale-[0.98]",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
