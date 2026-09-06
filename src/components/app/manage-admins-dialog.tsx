"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { buildInviteUrl } from "@/lib/invite/invite-link";
import { useAuthStore } from "@/lib/store/auth-store";
import { useT } from "@/lib/store/settings-store";
import * as repo from "@/lib/supabase/repo";
import type { MemberRow } from "@/lib/supabase/repo";
import { cn } from "@/lib/utils";

/**
 * Tentukan apakah user login adalah owner pada community aktif dengan mencari
 * membership yang communityId-nya cocok dengan activeCommunityId lalu memeriksa
 * role === "owner". Fungsi murni agar mudah dipakai ulang & tidak menyentuh I/O.
 */
function isOwnerOfActive(
  memberships: { communityId: string; role: string }[],
  activeCommunityId: string | null,
): boolean {
  if (!activeCommunityId) return false;
  const m = memberships.find((x) => x.communityId === activeCommunityId);
  return m?.role === "owner";
}

/**
 * Tombol pembuka dialog kelola admin. HANYA dirender untuk user ber-role
 * `owner` pada community aktif (Req 6.9, 5.1–5.4). Bila bukan owner, komponen
 * ini mengembalikan null sehingga aksi owner tidak pernah muncul di UI.
 *
 * Cara memasang: cukup render <ManageAdminsButton /> di tempat mana pun
 * (mis. SettingsScreen atau header AppShell). Ia mengelola state buka/tutup
 * dialog sendiri.
 */
export function ManageAdminsButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const memberships = useAuthStore((s) => s.memberships);
  const activeCommunityId = useAuthStore((s) => s.activeCommunityId);

  const owner = isOwnerOfActive(memberships, activeCommunityId);
  // Bukan owner (atau belum ada community aktif) → jangan render trigger.
  if (!owner || !activeCommunityId) return null;

  return (
    <>
      <Button
        variant="outline"
        className={cn("w-full justify-start", className)}
        onClick={() => {
          haptic(8);
          setOpen(true);
        }}
      >
        <ShieldCheck size={18} />
        {t("admin.manage")}
      </Button>
      {open && (
        <ManageAdminsDialog
          communityId={activeCommunityId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Dialog kelola admin (owner-only). Diasumsikan hanya dirender ketika user
 * adalah owner community aktif (lihat ManageAdminsButton). Menyediakan:
 *  - Undang admin via email (repo.createInvite; RLS + trigger email menangani
 *    sisanya).
 *  - Daftar member (repo.listCommunityMembersWithEmail) dengan badge owner/admin
 *    dan email sebagai identitas utama (owner-only RPC).
 *  - Kick member non-owner (repo.kickMember) dengan konfirmasi ringan.
 *  - Hapus community (repo.deleteCommunity) dengan konfirmasi.
 */
export function ManageAdminsDialog({
  communityId,
  onClose,
}: {
  communityId: string;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const loadMemberships = useAuthStore((s) => s.loadMemberships);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Undang admin
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Link undangan hasil createInvite → ditampilkan untuk share manual.
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Kick / delete
  const [kicking, setKicking] = useState<string | null>(null);
  const [confirmKick, setConfirmKick] = useState<MemberRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reload daftar member setelah aksi (kick/invite). Tidak menyetel loading
  // agar tidak mengosongkan daftar sesaat; dipakai di luar effect.
  const refresh = useCallback(async () => {
    const rows = await repo.listCommunityMembersWithEmail(communityId);
    setMembers(rows);
  }, [communityId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await repo.listCommunityMembersWithEmail(communityId);
        if (!cancelled) setMembers(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const sendInvite = async () => {
    const value = email.trim();
    if (!value || inviting) return;
    haptic(12);
    setInviting(true);
    setInviteError(null);
    setLinkCopied(false);
    try {
      const invite = await repo.createInvite(communityId, value);
      // Bangun link pendaftaran dari origin aktif + token invite (satu sumber
      // kebenaran format via buildInviteUrl). Komponen "use client" → window ada.
      // Hanya link yang ditampilkan — tidak ada pesan "terkirim".
      setInviteLink(buildInviteUrl(window.location.origin, invite.token));
      setEmail("");
      // Undangan belum jadi member sampai di-redeem; tetap refresh untuk jaga
      // konsistensi bila daftar berubah karena aksi lain.
      await refresh();
    } catch (e) {
      setInviteError(describe(e));
    } finally {
      setInviting(false);
    }
  };

  // Salin link undangan ke clipboard lalu tampilkan feedback "Tersalin" yang
  // hilang otomatis setelah ~2 detik.
  const copyLink = async () => {
    if (!inviteLink) return;
    haptic(8);
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard bisa gagal (izin/konteks non-secure); abaikan diam-diam,
      // link tetap terlihat & bisa di-select manual.
    }
  };

  const doKick = async (row: MemberRow) => {
    if (kicking) return;
    haptic(15);
    setKicking(row.userId);
    try {
      await repo.kickMember(communityId, row.userId);
      setConfirmKick(null);
      await refresh();
    } finally {
      setKicking(null);
    }
  };

  const doDelete = async () => {
    if (deleting) return;
    haptic(20);
    setDeleting(true);
    try {
      await repo.deleteCommunity(communityId);
      // Muat ulang memberships → status berubah (ready/needsOnboarding) dan
      // guard mengarahkan ke onboarding bila tak ada community tersisa.
      await loadMemberships();
      onClose();
      router.replace("/app");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetTitle className="text-lg font-bold">
          {t("admin.manage")}
        </SheetTitle>

        <div className="mt-4 flex flex-col gap-6">
          {/* Undang admin */}
          <section>
            <label className="mb-1 block text-sm font-medium">
              {t("admin.inviteEmail")}
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("admin.inviteEmail")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInviteError(null);
                }}
              />
              <Button
                onClick={sendInvite}
                disabled={email.trim().length === 0 || inviting}
              >
                <Link2 size={18} />
                {t("admin.generateLink")}
              </Button>
            </div>
            {/* Invite email-bound: link hanya valid untuk email yang diundang. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.inviteEmailBoundHint")}
            </p>
            {inviteError && (
              <p className="mt-1 text-xs text-destructive">{inviteError}</p>
            )}

            {/* Link undangan untuk share manual (mis. WhatsApp). Muncul setelah
                createInvite sukses; email juga terkirim otomatis oleh trigger. */}
            {inviteLink && (
              <div className="mt-3 flex flex-col gap-2">
                <label
                  htmlFor="invite-link"
                  className="block text-sm font-medium"
                >
                  {t("admin.inviteLink")}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="invite-link"
                    readOnly
                    value={inviteLink}
                    aria-label={t("admin.inviteLink")}
                    className="break-all font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={t("admin.copyLink")}
                    onClick={() => void copyLink()}
                  >
                    {t("admin.copyLink")}
                  </Button>
                </div>
                {linkCopied && (
                  <p className="text-xs text-green-600">
                    {t("admin.linkCopied")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("admin.inviteLinkHint")}
                </p>
              </div>
            )}
          </section>

          {/* Daftar member */}
          <section>
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              {t("admin.members")}
            </div>
            <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto">
              {loading && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  …
                </p>
              )}
              {!loading &&
                members.map((m) => {
                  const isOwner = m.role === "owner";
                  return (
                    <div
                      key={m.userId}
                      className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {m.email ?? m.userId}
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium",
                            isOwner
                              ? "bg-primary/15 text-primary"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {isOwner
                            ? t("admin.ownerBadge")
                            : t("admin.adminBadge")}
                        </span>
                      </div>
                      {/* Owner tidak bisa di-kick → tombol tidak dirender. */}
                      {!isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive"
                          disabled={kicking === m.userId}
                          onClick={() => {
                            haptic(10);
                            setConfirmKick(m);
                          }}
                        >
                          <Trash2 size={16} />
                          {t("admin.kick")}
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>

          {/* Hapus community */}
          <section>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                haptic(12);
                setConfirmDelete(true);
              }}
            >
              <Trash2 size={18} />
              {t("admin.deleteCommunity")}
            </Button>
          </section>
        </div>
      </SheetContent>

      {/* Konfirmasi kick */}
      {confirmKick && (
        <Sheet
          open
          onOpenChange={(o) => !o && !kicking && setConfirmKick(null)}
        >
          <SheetContent>
            <SheetTitle className="text-lg font-bold">
              {t("admin.kick")}
            </SheetTitle>
            <p className="mt-2 break-all text-sm text-muted-foreground">
              {confirmKick.email ?? confirmKick.userId}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmKick(null)}
                disabled={kicking !== null}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={kicking !== null}
                onClick={() => void doKick(confirmKick)}
              >
                {t("admin.kick")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Konfirmasi hapus community */}
      {confirmDelete && (
        <Sheet
          open
          onOpenChange={(o) => !o && !deleting && setConfirmDelete(false)}
        >
          <SheetContent>
            <SheetTitle className="text-lg font-bold">
              {t("admin.deleteCommunity")}
            </SheetTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("admin.deleteConfirm")}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deleting}
                onClick={() => void doDelete()}
              >
                {t("admin.deleteCommunity")}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Sheet>
  );
}

/** Ekstrak pesan error yang manusiawi dari objek error apa pun. */
function describe(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return "Terjadi kesalahan tak terduga.";
}
