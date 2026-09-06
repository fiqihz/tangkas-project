# Requirements Document

## Introduction

Fase 2 mengubah TangkasBoard dari aplikasi internal ber-gembok password (Opsi B)
menjadi aplikasi multi-tenant dengan autentikasi sungguhan (Opsi C). Fitur ini
mengganti `PasswordGate` client-side dengan Supabase Auth (Google + Email/Password),
memperkenalkan model tenant berbasis tabel `membership` (satu user bisa tergabung di
banyak community), menambah alur onboarding pembuatan community, undangan admin via
email, community switcher, migrasi data lama satu kali, dan Row Level Security (RLS)
ketat per-community yang menggantikan policy permisif `anon using(true)`.

Ketiga blocker keamanan go-public (autentikasi, RLS ketat, multi-tenant beneran)
dikerjakan sebagai satu fondasi karena saling bergantung: RLS yang benar butuh
`auth.uid()`, dan multi-tenant butuh keanggotaan yang diverifikasi.

**Di luar scope fitur ini** (dikerjakan pada fase terakhir setelah auth):
enhancement visual `/app` (redesign layout, palet, tipografi). Fase ini hanya
menambah elemen UI fungsional yang diperlukan auth (login, register, onboarding,
switcher, kelola admin, logout).

**Juga di luar scope Fase 2:** jalur masuk role `member`. Undangan via email pada
fase ini khusus untuk role `admin`. Role `member` bersifat read-only dan jalur
masuknya bersifat non-invite (mis. join link / share link publik) yang akan didesain
pada fase berikutnya; mekanisme spesifiknya belum dikunci sekarang. Skema tetap
menampung role `member`, tetapi tidak ada alur pembuatan membership `member` di Fase 2.

**Batasan lingkungan yang menjadi prasyarat, bukan requirement fungsional aplikasi:**

- Berkas `.env.local` dan `.env` di-gitignore dan tidak boleh di-commit.
- Project Supabase adalah CLOUD dengan ref `cvuqtwikykyhcaxyjqba`.
- Migrasi ditulis sebagai berkas SQL bernomor di `supabase/migrations/` (lanjutan `000`–`011`).
- Edge Functions memakai runtime Deno.
- UI "Database Webhooks" dashboard tidak tersedia; trigger DB memakai `net.http_post` (pg_net) mengikuti pola migration `011`.
- Pengiriman email dari `onboarding@resend.dev` hanya bisa menjangkau email pemilik akun Resend; undangan ke email pihak lain memerlukan verifikasi domain terlebih dahulu.
- Verifikasi wajib tiap perubahan: `npm run typecheck` → `npm run lint` → `npm run build` (semua exit 0). Perubahan auth/RLS/migrasi dinyatakan bagian mana yang belum bisa diverifikasi otomatis (RLS butuh uji manual multi-user).

## Glossary

- **TangkasBoard**: Aplikasi web (Next.js) untuk mengelola sesi mabar badminton.
- **Auth_System**: Subsistem autentikasi berbasis Supabase Auth yang mengelola sign-up, sign-in, sesi, dan sign-out.
- **Onboarding_System**: Subsistem yang menuntun user tanpa community untuk membuat community baru.
- **Membership_System**: Subsistem yang mengelola relasi user ↔ community beserta role melalui tabel `membership`.
- **Invite_System**: Subsistem yang mengelola undangan admin via email melalui tabel `invite`.
- **Switcher_System**: Komponen UI di `/app` untuk memilih community aktif ketika user tergabung di lebih dari satu community.
- **RLS_Policy**: Kumpulan Row Level Security policy PostgreSQL yang membatasi akses baris per-community.
- **Migration_System**: Proses migrasi data lama satu kali yang mengklaim baris ber-`DEFAULT_COMMUNITY_ID` ke community pertama milik user.
- **Repo_Layer**: Modul `src/lib/supabase/repo.ts`, satu-satunya lapisan yang berkomunikasi langsung dengan Supabase.
- **community**: Tenant; entitas yang menaungi seluruh data mabar (baris pada tabel `community`).
- **membership**: Baris yang menautkan satu user ke satu community dengan satu role.
- **invite**: Baris undangan berisi `email`, `community_id`, `role`, `token`, `status`, `expires_at`.
- **owner**: Role pembuat community; satu-satunya role yang boleh menghapus community dan mengelola daftar admin; tidak dapat dikeluarkan (di-kick).
- **admin**: Role host tambahan; dapat melihat dan mengubah seluruh data community (mabar, pemain, skor).
- **member**: Role read-only yang akan datang; skema wajib menampungnya meski belum diimplementasikan.
- **active_community**: community yang sedang dipilih user sebagai konteks kerja di `/app`.
- **DEFAULT_COMMUNITY_ID**: UUID `00000000-0000-0000-0000-000000000001`, penanda data lama era Opsi B.
- **authenticated**: Role Supabase untuk user yang sudah login.
- **anon**: Role Supabase untuk permintaan tanpa login.
- **PasswordGate**: Komponen gembok password lama (`src/components/password-gate.tsx`) yang akan di-retire.

## Requirements

### Requirement 1: Autentikasi Supabase (Email/Password + Google)

**User Story:** Sebagai host mabar, saya ingin masuk dengan akun sungguhan (email/password atau Google), sehingga data mabar saya terlindungi dan tidak bisa diakses sembarang orang.

#### Acceptance Criteria

1. WHERE provider Email/Password dipilih, THE Auth_System SHALL mendaftarkan user baru menggunakan Supabase Auth dengan email dan password.
2. WHERE provider Google dipilih, THE Auth_System SHALL mengautentikasi user melalui OAuth Google Supabase.
3. WHEN user mengirim kredensial login yang valid, THE Auth_System SHALL membuat sesi terautentikasi dan mengarahkan user ke `/app`.
4. IF kredensial login tidak valid, THEN THE Auth_System SHALL menolak permintaan dan menampilkan pesan kesalahan tanpa membuat sesi.
5. WHEN user memilih sign-out, THE Auth_System SHALL mengakhiri sesi terautentikasi dan mengarahkan user ke halaman landing (`/`).
6. THE Auth_System SHALL mengonfigurasi klien Supabase (`getSupabase()`) dengan `persistSession: true`.
7. WHILE tidak ada sesi terautentikasi, THE Auth_System SHALL mencegah akses ke `/app` dan mengarahkan user ke alur login.

### Requirement 2: Retire PasswordGate lama

**User Story:** Sebagai pemilik produk, saya ingin gembok password client-side dihapus, sehingga tidak ada jalur akses yang tidak aman tersisa setelah auth sungguhan aktif.

#### Acceptance Criteria

1. WHEN Auth_System aktif, THE TangkasBoard SHALL merender `/app` tanpa membungkusnya dengan PasswordGate.
2. THE TangkasBoard SHALL menghapus ketergantungan runtime pada `NEXT_PUBLIC_APP_PASSWORD` untuk kontrol akses `/app`.
3. WHEN user terautentikasi membuka `/app`, THE Auth_System SHALL memberi akses berdasarkan sesi Supabase, bukan status unlock localStorage.

### Requirement 3: Alur masuk dan onboarding

**User Story:** Sebagai user baru, saya ingin dituntun dari landing ke pembuatan community pertama, sehingga saya bisa langsung memakai aplikasi tanpa kebingungan.

#### Acceptance Criteria

1. WHEN user tak terautentikasi membuka halaman landing (`/`), THE TangkasBoard SHALL menyediakan jalur menuju login dan register.
2. WHEN user berhasil terautentikasi DAN belum menjadi anggota community mana pun, THE Onboarding_System SHALL mengarahkan user ke alur pembuatan community.
3. WHEN user menyelesaikan pembuatan community pada onboarding, THE Membership_System SHALL membuat baris membership dengan role `owner` untuk user tersebut pada community baru.
4. WHEN user terautentikasi yang sudah menjadi anggota minimal satu community membuka aplikasi, THE TangkasBoard SHALL mengarahkan user ke `/app`.
5. WHILE user berada pada alur onboarding, THE Onboarding_System SHALL meminta nama community sebelum membuat community.

### Requirement 4: Model tenant via tabel membership

**User Story:** Sebagai host yang membantu beberapa komunitas, saya ingin satu akun bisa tergabung di banyak community, sehingga saya tidak perlu akun terpisah untuk tiap komunitas.

#### Acceptance Criteria

1. THE Membership_System SHALL menyimpan relasi user ke community pada tabel `membership` dengan kolom `user_id`, `community_id`, dan `role`.
2. THE Membership_System SHALL mengizinkan satu user memiliki baris membership pada lebih dari satu community.
3. THE Membership_System SHALL memastikan satu user memiliki paling banyak satu baris membership per community.
4. WHERE nilai role disimpan, THE Membership_System SHALL menerima nilai `owner`, `admin`, dan `member`.
5. WHEN membership dibuat pada onboarding pembuatan community, THE Membership_System SHALL menetapkan role `owner`.
6. THE Membership_System SHALL tidak membuat baris membership ber-role `member` melalui alur apa pun pada Fase 2 karena jalur pembuatan membership `member` belum tersedia pada fase ini.

### Requirement 5: Peran dan otorisasi

**User Story:** Sebagai owner community, saya ingin membedakan hak owner dan admin, sehingga hanya saya yang bisa menghapus community dan mengatur siapa saja host-nya.

#### Acceptance Criteria

1. WHERE user memiliki role `owner` pada community, THE Membership_System SHALL mengizinkan user tersebut menghapus community.
2. IF user tanpa role `owner` mencoba menghapus community, THEN THE Membership_System SHALL menolak operasi tersebut.
3. WHERE user memiliki role `owner` pada community, THE Membership_System SHALL mengizinkan user tersebut mengelola daftar admin community.
4. IF permintaan bertujuan mengeluarkan (kick) user ber-role `owner`, THEN THE Membership_System SHALL menolak permintaan tersebut.
5. WHERE user memiliki role `owner` atau `admin` pada community, THE TangkasBoard SHALL mengizinkan user tersebut melihat dan mengubah data mabar, pemain, dan skor community tersebut.
6. THE Membership_System SHALL mempertahankan definisi role `member` sebagai read-only pada skema meski perilaku read-only belum diimplementasikan pada fase ini.
7. THE Membership_System SHALL memperlakukan jalur masuk role `member` sebagai jalur non-invite (mis. join link / share link publik) yang belum diimplementasikan pada Fase 2, sehingga baik perilaku read-only maupun jalur masuk `member` berada di luar scope fase ini.

### Requirement 6: Undangan admin via email

**User Story:** Sebagai owner community, saya ingin mengundang host tambahan (role `admin`) lewat email undangan, sehingga hanya orang yang saya undang yang bisa menjadi admin (bukan self-service, dan bukan jalur masuk role `member`).

#### Acceptance Criteria

1. THE Invite_System SHALL menyimpan undangan pada tabel `invite` dengan kolom `email`, `community_id`, `role`, `token`, `status`, dan `expires_at`.
2. WHEN owner memasukkan email calon admin, THE Invite_System SHALL membuat baris invite berstatus tertunda dengan `token` unik dan `expires_at` di masa depan.
3. WHEN sebuah invite dibuat, THE Invite_System SHALL mengirim email undangan berisi tautan yang memuat `token` melalui Resend.
4. WHEN penerima membuka tautan undangan yang valid dan belum kedaluwarsa, THE TangkasBoard SHALL mengarahkan penerima ke halaman register.
5. WHEN penerima menyelesaikan register melalui tautan undangan yang valid, THE Membership_System SHALL membuat membership dengan role `admin` pada community terkait.
6. WHEN sebuah undangan berhasil ditukar menjadi membership, THE Invite_System SHALL menetapkan status invite menjadi telah dipakai.
7. IF tautan undangan sudah kedaluwarsa berdasarkan `expires_at`, THEN THE Invite_System SHALL menolak penukaran undangan dan tidak membuat membership.
8. IF sebuah undangan sudah berstatus telah dipakai, THEN THE Invite_System SHALL menolak penukaran ulang undangan tersebut.
9. THE TangkasBoard SHALL membatasi pembuatan undangan hanya untuk user ber-role `owner` pada community terkait.
10. THE Invite_System SHALL membuat undangan hanya untuk role `admin` dan menolak nilai role `member` pada Fase 2, karena alur undangan email ini khusus role `admin` dan bukan jalur masuk role `member`.

### Requirement 7: Row Level Security ketat per-community

**User Story:** Sebagai pemilik produk, saya ingin setiap community hanya bisa mengakses datanya sendiri, sehingga data satu komunitas tidak bocor atau bisa diubah komunitas lain.

#### Acceptance Criteria

1. THE RLS_Policy SHALL menggantikan policy permisif `anon using(true) with check(true)` pada tabel `community`, `player_profile`, `session`, `session_player`, `court`, dan `match`.
2. WHERE permintaan melakukan operasi tulis pada tabel data community, THE RLS_Policy SHALL mengizinkan operasi hanya untuk role `authenticated`.
3. WHERE user terautentikasi mengakses baris data suatu community, THE RLS_Policy SHALL mengizinkan akses hanya jika terdapat baris `membership` yang mencocokkan `auth.uid()` dengan `community_id` baris tersebut.
4. IF user terautentikasi mengakses baris data community yang tidak memuat keanggotaannya, THEN THE RLS_Policy SHALL menolak akses baris tersebut.
5. THE RLS_Policy SHALL memastikan tabel `session_player`, `court`, dan `match` diberlakukan pemeriksaan keanggotaan community melalui relasi ke `session.community_id`.
6. THE RLS_Policy SHALL memberlakukan pemeriksaan keanggotaan pada tabel `membership` dan `invite` sehingga user hanya mengakses baris untuk community tempat user tersebut menjadi anggota.

### Requirement 8: Community aktif dan switcher

**User Story:** Sebagai user yang tergabung di beberapa community, saya ingin memilih community aktif di `/app`, sehingga data yang saya kelola sesuai konteks komunitas yang dipilih.

#### Acceptance Criteria

1. WHEN user terautentikasi membuka `/app`, THE TangkasBoard SHALL menetapkan satu active_community dari daftar membership user.
2. WHERE user tergabung di lebih dari satu community, THE Switcher_System SHALL menampilkan community switcher di `/app`.
3. WHEN user memilih community lain pada switcher, THE TangkasBoard SHALL mengubah active_community menjadi community yang dipilih.
4. WHEN active_community berubah, THE TangkasBoard SHALL memuat ulang data `/app` untuk active_community yang baru.
5. WHERE user tergabung tepat di satu community, THE TangkasBoard SHALL menetapkan community tersebut sebagai active_community tanpa menampilkan switcher.

### Requirement 9: Wiring community aktif ke Repo Layer

**User Story:** Sebagai pengembang, saya ingin Repo Layer memakai community aktif user alih-alih ID default, sehingga seluruh query terikat pada tenant yang benar.

#### Acceptance Criteria

1. WHEN `/app` memanggil fungsi Repo_Layer yang menerima `communityId`, THE TangkasBoard SHALL memberikan id active_community sebagai argumen.
2. THE TangkasBoard SHALL berhenti menggunakan `DEFAULT_COMMUNITY_ID` sebagai sumber community aktif pada alur `/app`.
3. WHERE sebuah fungsi Repo_Layer membuat baris data community (`player_profile`, `session`), THE Repo_Layer SHALL menetapkan `community_id` baris sesuai id active_community yang diberikan.

### Requirement 10: Migrasi data lama satu kali

**User Story:** Sebagai host yang sudah memakai aplikasi era Opsi B, saya ingin data mabar lama saya diklaim ke community pertama yang saya buat, sehingga riwayat mabar tidak hilang saat pindah ke multi-tenant.

#### Acceptance Criteria

1. WHEN user pertama menyelesaikan pembuatan community pertamanya, THE Migration_System SHALL memindahkan seluruh baris ber-`community_id = DEFAULT_COMMUNITY_ID` pada tabel data ke id community baru tersebut.
2. THE Migration_System SHALL menjalankan pemindahan data lama tepat satu kali untuk keseluruhan data DEFAULT_COMMUNITY_ID.
3. IF tidak ada lagi baris ber-`community_id = DEFAULT_COMMUNITY_ID`, THEN THE Migration_System SHALL menyelesaikan proses tanpa mengubah data mana pun (idempoten).
4. WHEN Migration_System memindahkan data lama, THE Migration_System SHALL mempertahankan seluruh nilai kolom baris selain `community_id`.

## Catatan Verifikasi

- Perubahan pada UI, Repo_Layer, dan wiring dapat diverifikasi otomatis melalui `npm run typecheck`, `npm run lint`, dan `npm run build`.
- RLS_Policy per-community memerlukan uji manual multi-user (dua akun pada dua community berbeda) untuk memastikan tidak ada kebocoran antar tenant; ini tidak sepenuhnya terverifikasi oleh build.
- Migration_System memerlukan verifikasi manual pada data nyata karena bersifat satu kali dan sulit di-undo.
- Pengiriman email undangan ke alamat pihak ketiga bergantung pada verifikasi domain Resend; sebelum domain terverifikasi, pengujian pengiriman terbatas pada email pemilik akun Resend.
