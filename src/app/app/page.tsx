"use client";

import { AppShell } from "@/components/app-shell";
import { RouteGuard } from "@/components/auth/route-guard";

export default function AppPage() {
  return (
    <RouteGuard>
      <AppShell />
    </RouteGuard>
  );
}
