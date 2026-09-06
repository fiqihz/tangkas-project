import { describe, expect, it } from "vitest";
import {
  buildInviteEmailPayload,
  buildInviteSubject,
  buildInviteUrl,
} from "./invite-link";

// Task 4.3 — unit test penyusunan payload/link invite (Edge Function).
// _Requirements: 6.3, 6.4_ — kontrak tautan `/register?invite=TOKEN`.

describe("buildInviteUrl", () => {
  it("menyusun tautan persis ${origin}/register?invite=${token}", () => {
    expect(buildInviteUrl("https://tangkas-project.vercel.app", "abc123")).toBe(
      "https://tangkas-project.vercel.app/register?invite=abc123",
    );
  });

  it("menghapus satu trailing slash pada appUrl", () => {
    expect(buildInviteUrl("https://tangkas-project.vercel.app/", "tok")).toBe(
      "https://tangkas-project.vercel.app/register?invite=tok",
    );
  });

  it("menghapus beberapa trailing slash pada appUrl", () => {
    expect(buildInviteUrl("https://example.com///", "t")).toBe(
      "https://example.com/register?invite=t",
    );
  });

  it("tetap benar untuk appUrl tanpa trailing slash", () => {
    expect(buildInviteUrl("http://localhost:3000", "XYZ")).toBe(
      "http://localhost:3000/register?invite=XYZ",
    );
  });

  it("menyisipkan token apa adanya (contoh token UUID)", () => {
    const token = "550e8400-e29b-41d4-a716-446655440000";
    expect(buildInviteUrl("https://app.test", token)).toBe(
      `https://app.test/register?invite=${token}`,
    );
  });
});

describe("buildInviteSubject", () => {
  it("mengembalikan subjek konstan undangan admin", () => {
    expect(buildInviteSubject()).toBe(
      "[TangkasBoard] Undangan menjadi admin community",
    );
  });
});

describe("buildInviteEmailPayload", () => {
  it("menyusun body email dengan from, to, subject, dan html berisi tautan", () => {
    const payload = buildInviteEmailPayload({
      from: "TangkasBoard <onboarding@resend.dev>",
      email: "invitee@example.com",
      appUrl: "https://tangkas-project.vercel.app/",
      token: "tok-1",
    });

    expect(payload.from).toBe("TangkasBoard <onboarding@resend.dev>");
    expect(payload.to).toEqual(["invitee@example.com"]);
    expect(payload.subject).toBe(
      "[TangkasBoard] Undangan menjadi admin community",
    );
    expect(payload.html).toContain(
      "https://tangkas-project.vercel.app/register?invite=tok-1",
    );
  });

  it("meng-escape karakter HTML pada tautan (mis. token dengan &)", () => {
    const payload = buildInviteEmailPayload({
      from: "sender@test",
      email: "a@b.com",
      appUrl: "https://app.test",
      token: "a&b",
    });

    // Tautan mentah tidak boleh muncul (harus di-escape menjadi &amp;).
    expect(payload.html).not.toContain("invite=a&b<");
    expect(payload.html).toContain("invite=a&amp;b");
  });
});
