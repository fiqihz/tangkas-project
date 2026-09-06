import { describe, expect, it } from "vitest";

import { guardDecision, type GuardAction } from "./guard-decision";
import type { AuthStatus } from "@/lib/store/auth-store";

/**
 * Integration test route guard (contoh 1–3+): memetakan `auth-store.status`
 * ke aksi guard. Menguji perilaku keputusan guard tanpa render React —
 * environment vitest project adalah `node` (tanpa jsdom / @testing-library),
 * sehingga logika keputusan diekstrak ke fungsi murni `guardDecision`.
 *
 * _Requirements: 1.7, 3.2, 3.4_
 * _Design: Testing Strategy → Unit & integration_
 */
describe("guardDecision — pemetaan status auth → aksi route guard", () => {
  it("signedOut → toLogin (redirect ke /login)", () => {
    expect(guardDecision("signedOut")).toBe<GuardAction>("toLogin");
  });

  it("needsOnboarding → toOnboarding (redirect ke /onboarding)", () => {
    expect(guardDecision("needsOnboarding")).toBe<GuardAction>("toOnboarding");
  });

  it("ready → render (tampilkan children)", () => {
    expect(guardDecision("ready")).toBe<GuardAction>("render");
  });

  it("loading → loading (render null sambil sesi dibaca)", () => {
    expect(guardDecision("loading")).toBe<GuardAction>("loading");
  });

  it("setiap status memetakan ke tepat satu aksi yang valid", () => {
    const statuses: AuthStatus[] = [
      "loading",
      "signedOut",
      "needsOnboarding",
      "ready",
    ];
    const valid: GuardAction[] = ["loading", "toLogin", "toOnboarding", "render"];
    for (const s of statuses) {
      expect(valid).toContain(guardDecision(s));
    }
  });
});
