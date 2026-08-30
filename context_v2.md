Changes/Update:
1. Gua akan ubah skema dan validasi functional dari button `autofill` bro. Next-nya udah ga bakalan ada button autofill lagi, cuma button `Manual` aja di page `Lapangan`. Why?
- Button `Manual` digunakan untuk input nama Player di Match awal
- Setelah host input -> game berlangsung -> sistem otomatis langsung show 4 next player di card lapangan tersebut (gua kepikirannya dibawah button `Manual` itu ada highlight untuk 4 orang next player-nya)
- Gua kepikirannya gini karena gua bisa lebih cepat prepare 4 orang tersebut sebelum previous match selesai
- Jadi sebenernya validasi `autofill` itu udah ga by trigger button lagi, tapi langsung jalan disaat sudah ada match yg berlangsung
Contoh simulasi skenario:
- Player ada 16 orang dan ada 2 lapangan
- Semua player sudah checkin 
- Host input manual 4 player pertama di Lapangan A -> klik submit -> match berlangsung
- Ketika match berlangsung, di saat yg sama sistem sudah menampilkan 4 player berikut-nya yg akan main di Lapangan A
- Ketika host input manual 4 player di Lapangan B -> host input nama yg di rekomendasikan untuk bermain berikutnya di Lapangan A -> submit -> match berlangsung. Yang terjadi apa? Sistem re-calculate lagi 4 player di rekomendasikan untuk next game di Lapangan A dan juga skaligus 4 player juga untuk next game di Lapangan B
- Untuk di match ke-2 di masing-masing lapangan kan masih ada yg 0x main tuh (which is 8 orang sisa-nya), seharusnya nama yg di rekomendasikan adalah nama 8 orang yg masih 0x main itu
- Nah nama yg di rekomendasikan akan otomatis naik ke match yg sedang berlangsung ketika host sudah menyelesaikan match sebelumnya dan sudah berhasil submit skor

2. Butuh penambahan gender dari setiap player? karena skema permainan akan berubah. Contoh simulasinya seperti ini:
- game pertama manual untuk semua player
- game kedua itu ganda campuran (cewek dan cowok) atau gendongan (advance/intermediate & newbie vs advance/intermediate & newbie) -> prioritaskan ganda campuran baru ke gendongan
- game ketiga sesuai kelas (newbie tetap ga ngelawan newbie sesuai rules kita sebelumnya. prioritas newbie rekomendasi-nya dipasangkan sama beginner, untuk level lain bisa melawan sesuai levelnya masing-masing, contoh beginner vs beginner, intermediate vs intermediate)
- tapi untuk level yg advance kalo semisal kurang banyak player-nya, mungkin bisa dikombinasikan dengan intermediate aja

3. Tambahkan history match setiap lapangan (even when lapangan di hapus, history-nya harus tetap ada)
- Ini gua kepikiran ada page baru yaitu History
- Di page itu bisa menampilkan semua match yg sudah terjadi di masing-masing lapangan
- Misal ada 3 lapangan dan masing-masing lapangan sudah melakukan 4x match -> semua history dari match seperti player siapa lawan player siapa dan skor akhirnya berapa itu kecatet di page itu
- Di page ini juga user/host dapat melakukan edit pada match yg telah selesai. Semisal salah melakukan input skor maka host dapat mengganti skor-nya di page ini

4. Cek leaderboard, untuk nama player yg total bermainnya itu kurang dibanding player lain -> maka ada penambahan 25 poin 
- Misalkan mabar telah selesai dan ada beberapa player ternyata total mainnya itu kurang 1-2x main dari player yg memiliki jatah main terbanyak
- Nah poin akan ditambahkan 25 poin dari setiap match yg tertinggal -> misal tertinggal 2 jatah match dari yg paling banyak bermain maka 25 * 2
- Kolom `S` atau Seri itu dihapus aja di livescore, dan digantikan menjadi `+M` dimana kolom itu memiliki nilai dari total bonus poin yg didapatkan oleh player tersebut

5. Di page `skor` tambahkan kolom win rate dengan formula jumlah menang / jumlah main * 100

6. Menambahkan list Mabar yg sudah dilakukan.
- Untuk sekarang main page nya kan itu `Mulai Mabar Baru`
- Gua kepikiran main page-nya itu jadi list semua mabar yg sudah or akan dilakukan
- Misalkan sudah ada 2 mabar yg dilakukan sebelumnya, 1 mabar yg active, dan 1 mabar yg scheduled. ini semua akan di tampilkan di page ini
- Jadi flownya ketika user akses URL app ini -> Login -> show list mabar (dengan masing-masing mabar ada statusnya scheduled/finished/ongoing) -> user bisa melihat dan edit semua list mabar yg sudah dilakukan sebelumnya
- Dan ada button Tambah dibagian bawah untuk menambahkan jadwal mabar baru
- Dan juga gua kepikiran, untuk Mabar dengan status udah Finished -> user bisa edit lagi isi mabar tersebut dan status berubah lagi menjadi ongoing selama user/host belum klik SELESAI MABAR (gua kepikiran ini karena kali aja gua udah pencet SELESAI MABAR eh ternyata gua jadinya mau nambah jam bermain, jadi harusnya bisa aktif lagi biar gua bisa edit)
- Mabar yg telah selesai akan masuk di list mabar dengan status finisihed

7. tambah fitur sort by first check in untuk status active di page `Pemain`

8. button `Ganti / salah pilih` -> ini bisa ganti ke semua pemain baik yg aktif ataupun sedang bermain (tetap show preferred pemain sesuai level) 
- Nah ini agak bentrok lagi dengan validasi yg sebelumnya gua bilang kan ya. sebelumnya gua minta button ini cuma ada pas match pertama
- Tapi untuk sekarang akan always ditampilkan aja incase gua mau ubah player yg bermain di Lapangan A
- Di fitur ini show semua list pemain baik pemain yg statusnya Active (sedang menunggu bermain) maupun player yg sedang bermain di lapangan yg sama or lapangan yg berbeda. Kenapa?
- Ya bisa aja gua mau ganti Player C di Lapangan 2 ke Player A di Lapangan 1. List namanya tetep lu show preferred dan semua list nama. Preferred yg itu menyesuaikan level match itu kayak validasi existing aja yg udah dibuat
- Dan gua juga bisa ganti Player C di lapangan 2 ke Player B di lapangan 2 juga yg sama. in case gua mau tuker lawannya aja di lapangan yg sama 

9. tambahkan menu untuk back ke list mabar (previous, scheduled, active)

10. di main page untuk start new session -> better tambain nama lapangan sesuai total lapangan yg di input (karena menyesuaikan nomor lapangan di gor)
- Untuk sekarang kan cuma bisa input total lapangan aja
- Gua mau-nya ada field untuk isi nama lapangan juga. Kenapa?
- Karena memudahkan gua kalo gua main di gor yg lapangannya itu banyak banget, jadi gua bisa isi Lapangan 14, lapangan 17, Lapangan 21 gitu. Biar lebih gampang aja

11. relate ke poin 10, di page Lapangan itu bisa editable nama lapangannya juga. Fungsinya sama aja sih dengan poin 10, cuma bedanya ini di page Lapangan juga bisa edit nama Lapangannya

12. behaviour delete lapangan saat match sedang berjalan
- saat gua coba delete lapangan ketika match sedang berjalan -> player yg sedang bermain itu nyangkut statusnya ga berubah ke aktif
- jadinya player tersebut ga akan bermain lagi di sisa lapangan yg ada
- better player di lapangan tersebut di ubah ke aktif biar bisa di autofill lagi. yg sekarang nama player di lapangan dengan match sedang berjalan masih di hitung bermain dan tidak masuk di sistem autofill