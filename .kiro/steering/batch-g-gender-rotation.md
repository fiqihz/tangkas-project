---
inclusion: manual
---

# Batch G — Gender + Rotasi Per-Ronde (DITUNDA, belum dikerjakan)

Catatan lengkap untuk dibahas mendalam sebelum diimplementasi. Semua poin lain
(Batch A–F) sudah selesai. Batch ini sengaja ditunda atas permintaan user karena
mengubah "otak" matchmaking dan perlu dirancang presisi dulu.

## Permintaan asli user (dari context_v2.md poin 2)

Butuh penambahan **gender** setiap player karena skema permainan berubah:
- Game pertama: manual untuk semua player (sudah sesuai desain existing).
- Game kedua: **ganda campuran** (cewek & cowok) ATAU **gendongan**
  (advance/intermediate & newbie vs advance/intermediate & newbie).
  → **prioritaskan ganda campuran dulu**, baru gendongan.
- Game ketiga: **sesuai kelas** (aturan level existing):
  - Newbie tetap TIDAK melawan/berpasangan sesama Newbie (hard rule existing).
  - Prioritas Newbie dipasangkan dengan Beginner.
  - Level lain melawan sesuai levelnya (Beginner vs Beginner, Intermediate vs Intermediate).
- Untuk level **Advanced**: kalau player-nya kurang banyak, boleh dikombinasikan
  dengan Intermediate saja.

## Pertanyaan desain yang MASIH perlu dijawab user sebelum ngoding

1. **"Ronde" itu per-lapangan atau global?**
   - Ini KRUSIAL & berpotensi bentrok dengan Batch A. Di Batch A tiap lapangan
     jalan independen (Lapangan A bisa match ke-3 sementara Lapangan B baru ke-2).
   - Jadi "game kedua = campuran, game ketiga = kelas" itu dihitung per-lapangan
     (match ke-N di lapangan itu) atau berdasarkan ronde global?
2. **Ganda campuran: wajib atau best-effort?**
   - Kalau cewek cuma sedikit (mis. 2 dari 16), campuran tidak selalu mungkin.
     Perlu aturan fallback yang jelas.
3. **Definisi "gendongan" yang presisi.**
   - Apakah = tiap tim isi 1 kuat + 1 lemah, dan 2 tim seimbang bobotnya?
   - Ini kebalikan dari fairness "minimalkan selisih level" yang dibangun di Batch 1.
     Perlu ditegaskan tujuannya.
4. **Setelah game ketiga (kelas), ronde ke-4 dst polanya apa?**
   - Ulang siklus (campuran → gendongan → kelas)? Atau kembali ke matchmaking
     fairness biasa (existing)?

## Implikasi teknis (perkiraan)

- Tambah kolom `gender` di `player_profile` dan `session_player`
  (mis. 'male' | 'female' | null). Set manual seperti level.
- UI: input gender saat daftar pemain + editable (mirip level).
- Matchmaking (`src/lib/domain/matchmaking.ts`) perlu mode/strategi berbeda
  per nomor ronde/match — saat ini hanya satu strategi (minimalkan selisih level
  + anti-repeat). Perlu abstraksi "strategy" yang dipilih berdasarkan konteks.
- Hard rule Newbie+Newbie existing TETAP berlaku di semua mode.

## Prinsip yang HARUS dijaga (dari desain existing)

- Level tetap manual (tidak ada Elo/promosi otomatis).
- Hard rule: Newbie tidak boleh setim dengan Newbie.
- Bobot level: Newbie=1, Beginner=2, Intermediate=3, Advanced=4.
- Match pertama selalu manual (first come first play).
- Auto-generate hanya untuk pemain Active & sudah ber-level.

## Status

BELUM DIKERJAKAN. Aktifkan file ini (#batch-g-gender-rotation) saat user siap
membahas detailnya. Jawab dulu 4 pertanyaan desain di atas sebelum implementasi.
