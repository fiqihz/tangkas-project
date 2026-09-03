// ============================================================================
// Tipe data inti TangkasBoard
// ============================================================================

/** Level pemain — ditentukan manual oleh host (tidak ada promosi otomatis). */
export type Level = "newbie" | "beginner" | "intermediate" | "advanced";

/** Gender pemain — untuk mode match campuran & ganda putri. */
export type Gender = "male" | "female";

/** Mode pembentukan match, dipilih host saat Auto-fill. */
export type MatchMode =
  | "balanced" // minimalkan selisih level (default, existing)
  | "mixed" // ganda campuran: tiap tim 1 cowok + 1 cewek (best-effort)
  | "ladies" // ganda putri: 4 pemain cewek (relax hard rule Newbie)
  | "gendongan" // tiap tim 1 kuat + 1 lemah, 2 tim seimbang
  | "kelas"; // pasangkan sesama level

/** Status pemain dalam satu sesi mabar. */
export type PlayerStatus =
  | "registered" // sudah didaftarkan, belum tentu datang
  | "active" // sudah check-in & siap main
  | "resting" // istirahat sementara, belum pulang
  | "left"; // pulang / batal (keluar permanen)

/**
 * Profil pemain (lapisan roster — persisten lintas mabar).
 * `level` bisa null bila belum di-observe.
 */
export interface PlayerProfile {
  id: string;
  name: string;
  level: Level | null;
  gender: Gender | null;
}

/**
 * State pemain dalam satu sesi mabar (lapisan session — sementara).
 * Menggabungkan profil + data runtime yang dipakai matchmaking.
 */
export interface SessionPlayer {
  id: string;
  name: string;
  level: Level | null;
  gender: Gender | null;
  status: PlayerStatus;
  /** Waktu pertama kali check-in (ISO) — untuk sort urutan kedatangan. */
  checkedInAt?: string | null;
  /** Berapa kali pemain sudah menyelesaikan match di sesi ini. */
  gamesPlayed: number;
  /**
   * Nomor ronde global terakhir saat pemain menyelesaikan match.
   * Dipakai untuk penalti "baru selesai main" dan urutan menunggu.
   * null = belum pernah main.
   */
  lastPlayedRound: number | null;
  /**
   * Nomor ronde global saat pemain terakhir tersedia untuk antrian
   * (mis. saat check-in atau saat balik dari resting). Dipakai untuk
   * tie-break "paling lama menunggu".
   */
  availableSinceRound: number;
  /** Akumulasi statistik pertandingan. */
  wins: number;
  losses: number;
  draws: number;
  pointsScored: number;
  pointsConceded: number;
}

/** Satu tim (pasangan ganda). */
export interface Team {
  playerIds: [string, string];
}

/** Satu pertandingan di sebuah lapangan. */
export interface Match {
  id: string;
  courtId: string;
  /** Snapshot nama lapangan (untuk History; tetap ada walau court dihapus). */
  courtLabel?: string | null;
  round: number;
  teamA: Team;
  teamB: Team;
  /** Status match. */
  state: "proposed" | "playing" | "finished" | "unfinished";
  /** Waktu match mulai dimainkan (ISO) — di-set saat "Mulai Main". null bila belum. */
  startedAt?: string | null;
  /** Skor akhir (null bila belum di-Finish). */
  score: { a: number; b: number } | null;
  /** Pemenang: "a" | "b" | "draw" | null (belum selesai). */
  winner: "a" | "b" | "draw" | null;
}

/** Konfigurasi bobot & penalti untuk matchmaking (mudah di-tune). */
export interface MatchmakingConfig {
  /** Bobot penalti ketidakseimbangan level antar tim. */
  balanceWeight: number;
  /** Bobot penalti pengulangan partner (setim). */
  repeatPartnerWeight: number;
  /** Bobot penalti pengulangan lawan. */
  repeatOpponentWeight: number;
  /** Penalti bila memilih pemain yang baru selesai main di ronde sebelumnya. */
  justPlayedPenalty: number;
  /** Jumlah kandidat kombinasi yang dicoba per pembentukan match. */
  candidateSamples: number;
  /**
   * Toleransi selisih bobot antar tim yang dianggap "sama-sama seimbang".
   * Selisih <= nilai ini tidak dihukum (efektif 0). Membuat level tinggi
   * (mis. Advanced) bisa lawan sesama kelas, tidak selalu digendong.
   */
  imbalanceTolerance: number;
}

export const DEFAULT_CONFIG: MatchmakingConfig = {
  balanceWeight: 10,
  repeatPartnerWeight: 6,
  repeatOpponentWeight: 3,
  justPlayedPenalty: 8,
  candidateSamples: 400,
  imbalanceTolerance: 2,
};

/** Bobot numerik tiap level. */
export const LEVEL_WEIGHT: Record<Level, number> = {
  newbie: 1,
  beginner: 2,
  intermediate: 3,
  advanced: 4,
};

/** Label tampilan tiap level. */
export const LEVEL_LABEL: Record<Level, string> = {
  newbie: "Newbie",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
