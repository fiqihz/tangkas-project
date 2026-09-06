import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  MIN_PASSWORD_LENGTH,
  isCredentialsSubmittable,
  isValidEmail,
  isValidPassword,
} from "./form-validation";

/**
 * Unit test validasi form login/register (fungsi murni).
 *
 * _Requirements: 1.4_
 * _Design: Testing Strategy → Unit & integration_
 */

describe("isValidEmail", () => {
  it("menerima email berformat wajar", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("user.name@example.com")).toBe(true);
  });

  it("memangkas spasi tepi sebelum memvalidasi", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  it("menolak input kosong / hanya spasi", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("   ")).toBe(false);
  });

  it("menolak format jelas bukan email", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("no@domain")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("a b@example.com")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it(`menolak password lebih pendek dari ${MIN_PASSWORD_LENGTH}`, () => {
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("")).toBe(false);
  });

  it("menerima password dengan panjang minimum atau lebih", () => {
    expect(isValidPassword("123456")).toBe(true);
    expect(isValidPassword("a-long-password")).toBe(true);
  });
});

describe("isCredentialsSubmittable", () => {
  it("submit hanya bila email valid DAN password cukup panjang", () => {
    expect(isCredentialsSubmittable("user@example.com", "secret1")).toBe(true);
  });

  it("tidak submit saat email kosong", () => {
    expect(isCredentialsSubmittable("", "secret1")).toBe(false);
  });

  it("tidak submit saat password kosong / terlalu pendek", () => {
    expect(isCredentialsSubmittable("user@example.com", "")).toBe(false);
    expect(isCredentialsSubmittable("user@example.com", "123")).toBe(false);
  });

  it("tidak submit saat email tak valid meski password cukup", () => {
    expect(isCredentialsSubmittable("bogus", "secret1")).toBe(false);
  });

  it("konsisten dengan gabungan isValidEmail && isValidPassword untuk sembarang input", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (email, password) => {
        expect(isCredentialsSubmittable(email, password)).toBe(
          isValidEmail(email) && isValidPassword(password),
        );
      }),
      { numRuns: 100 },
    );
  });
});
