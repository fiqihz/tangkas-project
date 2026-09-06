"use client";

import { AppShell } from "@/components/app-shell";
import { PasswordGate } from "@/components/password-gate";

export default function AppPage() {
  return (
    <PasswordGate>
      <AppShell />
    </PasswordGate>
  );
}
