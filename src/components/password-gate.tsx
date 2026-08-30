"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isGateEnabled, isUnlocked, tryUnlock } from "@/lib/auth/gate";

/**
 * Gembok password Opsi B. Membungkus konten app.
 * Bila password tidak di-set, langsung tampilkan konten.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // Baca status unlock dari localStorage (client-only, tak bisa saat SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnlocked(isUnlocked());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!isGateEnabled() || unlocked) {
    return <>{children}</>;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tryUnlock(input)) {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-5xl">🏸</div>
        <h1 className="mt-2 text-2xl font-bold">TangkasBoard</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan password untuk masuk.
        </p>
      </div>
      <Card className="w-full">
        <CardContent className="pt-4">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input
              type="password"
              placeholder="Password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive">Password salah.</p>
            )}
            <Button type="submit">Masuk</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
