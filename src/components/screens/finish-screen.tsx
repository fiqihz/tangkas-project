"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { useSessionStore } from "@/lib/store/session-store";
import { haptic } from "@/lib/haptics";

export function FinishScreen() {
  const { players, finishSession } = useSessionStore();
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const rows = useMemo(
    () => buildLeaderboard(players.filter((p) => p.gamesPlayed > 0)),
    [players],
  );
  const champion = rows[0];

  const doFinish = async () => {
    haptic([20, 40, 20]);
    setFinishing(true);
    await finishSession();
    setFinishing(false);
    setConfirming(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold">Selesai Mabar</h2>
        <p className="text-sm text-muted-foreground">
          Tekan tombol di bawah untuk mengunci hasil akhir & menampilkan juara.
        </p>
      </div>

      {champion ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Card className="border-amber-300 bg-gradient-to-b from-amber-50 to-card dark:border-amber-800 dark:from-amber-950/40">
            <CardContent className="pt-4 text-center">
              <div className="text-5xl">🏆</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Pemuncak sementara
              </div>
              <div className="text-2xl font-bold">{champion.name}</div>
              <div className="text-sm text-muted-foreground">
                {champion.wins} menang · diff{" "}
                {champion.pointDiff >= 0 ? "+" : ""}
                {champion.pointDiff} · {champion.pointsScored} poin
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Belum ada hasil match. Selesaikan minimal satu match dulu.
        </p>
      )}

      <Button
        variant="destructive"
        size="lg"
        onClick={() => {
          haptic(15);
          setConfirming(true);
        }}
      >
        SELESAI MABAR
      </Button>

      <Sheet open={confirming} onOpenChange={setConfirming}>
        <SheetContent>
          <SheetTitle className="text-lg font-bold">
            Selesaikan mabar?
          </SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Hasil akhir akan ditampilkan & sesi diarsipkan. Roster, level, dan
            hitungan &quot;ikut mabar&quot; pemain tetap tersimpan untuk mabar
            berikutnya.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirming(false)}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={doFinish}
              disabled={finishing}
            >
              {finishing ? "Menyelesaikan…" : "Ya, selesai"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
