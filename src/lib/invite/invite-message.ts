import type { DictKey } from "@/lib/i18n/dict";

/**
 * Petakan `reason` penolakan redeem invite (dari RPC `redeem_invite` via
 * `repo.redeemInvite`) ke kunci i18n pesan yang sesuai. Dipakai bersama oleh
 * halaman `/register` dan `/invite` agar pemetaan tetap satu sumber (DRY).
 *
 * Reason yang dikenal:
 * - `email_mismatch` → invite.emailMismatch
 * - `expired`        → invite.expired
 * - `used`           → invite.used
 * - `not_found`      → invite.invalid
 * Reason tak dikenal → invite.invalid.
 */
export function inviteMessageKey(reason: string | undefined): DictKey {
  switch (reason) {
    case "email_mismatch":
      return "invite.emailMismatch";
    case "expired":
      return "invite.expired";
    case "used":
      return "invite.used";
    case "not_found":
    default:
      return "invite.invalid";
  }
}
