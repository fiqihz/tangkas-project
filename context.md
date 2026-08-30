Project Name: - (belum tau)

Background:
Gua sekarang jadi host mabar badminton. tugasnya itu mengatur alur permainan dalam mabar tersebut. setiap mabar, anggota yg main biasanya 16-24 orang, 3 lapangan badminton dengan durasi 2 jam. tugas gua yaitu gua harus bisa membagi agar setiap orang itu mendapat jatah main yg sama, bisa membagi setiap match itu level permainan dari setiap orang adil. contoh yg beginner vs beginner, atau bisa juga mix intermediate-beginner vs intermediate-beginner (karena ini permainan-nya ganda, jadi 1 intermediate 1 beginner).

Problem/Issue:
1. Gua terkadang masih bingung untuk membagi setiap orang agar bisa dapat jatah main yg sama, dan setiap match juga terasa adil (ga jomplang sebelah, misal di sebelah terlalu jago dan sebelahnya noob)
2. Selain pembagian dan level yg sama, gua juga harus menentukan skor dari masing-masing player, agar setelah mabar selesai, gua bisa liat siapa player dengan nilai tertinggi (kemenangan terbanyak dan average score-nya) karena setiap mabar ada hadiah voucher yg akan diberikan
3. Relate ke poin 1, karena setiap mabar itu orang-nya bisa beda-beda, otomatis gua juga belum tau level dari setiap player yg datang. Gua bisa tau level player tersebut setelah game pertama (karena disitu gua observe). dan setelah itu gua baru bisa menentukan game-game berikutnya pembagian level-nya agar fair.

What do i need?
1. Gue butuh app yg bisa selesaikan masalah gue diatas (website aja sih tapi bisa PWA karena gue aksesnya dari HP) yg nantinya bisa di deploy ke hosting yg free aja. Soal database gua belum kepikiran bagusnya gimana, karena paling data mabar-nya juga di reset setelah mabar selesai (max 1-2 hari setelah mabar lah).
2. Di app-nya nanti gua bisa isi skor dari masing-masing game yg sedang berjalan
3. Skor yg telah di isi nanti akan di akumulasi setelah mabar beres
4. Jadi misal gua Player A -> Menang 4x, Kalah 1x, Seri 1x itu kecatet
5. Total skor dari setiap game juga dicatet agar diakumulasi (karena setiap player bisa saja kayak Player A tadi result-nya). Jadi untuk handle total menang, kalah, dan seri yg sama itu untuk menentukan siapa nilai-nya lebih tinggi ya dari hasil skor setiap match-nya

Concern:
1. Gimana cara gua handle ketika ada player yg ga jadi datang?
Contoh case-nya:
- Gue udah list nama player di aplikasi ini, setelah di list nanti kan itu udah otomatis nanti pembagian bobot permainannya (sesuai jumlah orang + level dari masing-masing player)
- Kalo tiba-tiba ada yg cancel, gimana handle agar bobot permainan tidak berantakan?
2. Since game pertama udah pasti ga fair (karena di game pertama gua baru bisa liat level dari masing-masing player), gimana cara handle game kedua dan seterusnya agar tetep fair?


concern:
1. Gimana kalau misal ada player yg mau rest dulu? itu harus diganti ke player lain, cara nentuinnya gimana?
2. Gua pengennya ada tombol Finish/Selesai untuk masing-masing game. Misal ada 3 lapangan, otomatis ada 3 game, dan masing-masing game punya tombol Finish-nya masing-masing. Setelah button di klik -> langsung otomatis mapping ke player berikutnya
3. Gue kepikiran ada tombol SELESAI MABAR -> biar akumulasi skor akhir bisa diliat dan ketahuan skor dari setiap pemain
4. Relate ke poin 3, kalo bisa ada section livescore biar bisa dipantau, ga harus klik tombol SELESAI dulu baru gue tau


1. gua jadi kepikiran, game kedua gimana nentuinnya ya? soalnya itu kan orang yg baru game pertama juga, which is gua belum tau level dari player tersebut. atau kita sebutnya game ke 2 di lapangan A, itu adalah match pertama untuk orang yg baru datang, so gua masih isi manual dulu gitu + nentuin levelnya. atau lu ada insight ga?
2. Relate ke poin 1, biasanya ada player yg sering datang juga, jadi gua udah tau player tersebut levelnya apa. so dari awal pas gua regist player tersebut gua udah bisa isi level player tersebut
3. Relate ke poin 2, gua jadi kepikiran kalo memang player yg datang itu udah pernah main sebelumnya, better langsung di simpen aja levelnya, biar next mabar gua ga repot lagi nentuin level player tersebut
4. Relate ke poin 3, tapi ini jadi bertentangan dengan system localstorage yg digunakan juga kan ya, menurut lu gimana?


1. oh jadi ini ronde match ke-2 di lapangan A itu bisa hybrid lah ya, kalo misal udah ada levelnya dari mabar sebelumnya -> itu bisa langsung di auto generate player mana ketemu player mana. sedangkan kalau belum ada level, gua isi manual dulu aja kan? cuma yg butuh di note, auto generate di match ke-2 ini berlaku untuk player yg udah active aja kan?




case:
1. show list next match preferred name setelah klik autofill (kalo di lapangan B sudah di isi dengan nama2 preferred name di lapangan A -> maka preferred name di lapangan A di update ke active player lain). setelah klik finish, preferred name otomatis naik ke lapangan tersebut yg sedang berjalan (autofill gimana?)
- button auto fill dihapus. sistem trigger 
2. tambahkan history match setiap lapangan (even when lapangan di hapus, history-nya harus tetap ada) - page baru
3. cek leaderboard, untuk nama player yg total bermainnya itu kurang dibanding player lain -> maka ada penambahan 25 poin per-game yg kurang (tambahkan extra kolom di livescore samping poin)
4. relate ke poin 3, hapus aja kolom `seri` ga dipake bro
5. tambahkan kolom win rate dengan formula jumlah menang / jumlah main * 100
6. relate ke skema game dibawah -> tambahkan gender dari masing-masing player
7. (opsional) simpan hasil mabar saat klik `SELESAI MABAR`
8. relate ke poin 2 -> history match bisa di edit skor-nya (jadi mungkin ada section menu baru) - jadi setiap match di masing-masing lapangan bisa keliatan player yg main siapa saja dan skor dari masing-masing match itu berapa
9. show list masing-masing mabar dengan status (scheduled, ongoing, finished)
10. relate ke poin 10, mabar yg sudah finished bisa di edit or diubah ke ongoing lagi incase mabar masih lanjut
11. tambah sort by first check in untuk status active di page `Pemain`
12. relate ke point 11 -> button `autofill` bisa tambah validasi by first checkin
13. button `Ganti / salah pilih` -> ini bisa ganti ke semua pemain baik yg aktif ataupun sedang bermain (tetap show preferred pemain sesuai level) 
14. tambahkan menu untuk back ke list sesi (previous, scheduled, active)
15. di main page untuk start new session -> better tambain nama lapangan sesuai total lapangan yg di input (karena menyesuaikan nomor lapangan di gor)
16. relate ke poin 15, di page Lapangan itu bisa editable nama lapangannya bro
17. behaviour delete lapangan saat match sedang berjalan -> player di lapangan tersebut di ubah ke aktif biar bisa di autofill lagi. yg sekarang nama player di lapangan dengan match sedang berjalan masih di hitung bermain dan tidak masuk di sistem autofill

skema game:
- game pertama manual untuk semua player
- game kedua itu ganda campuran or gendongan (advance - newbie) -> prioritaskan ganda campuran baru ke gendongan
- game ketiga sesuai kelas (newbie tetap nda ketemu, prioritas rekomendasi dipasangkan sama beginner, untuk level lain bisa match)