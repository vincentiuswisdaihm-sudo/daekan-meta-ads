---
name: 1-riset
description: Fase 1 pipeline daekan-meta-ads. Menjalankan subagent ads-researcher untuk satu produk dan menghasilkan research/latest.md berisi tabel performa Meta Ads vs omzet UTM Daekan, kandidat ad fatigue, rangkuman hook kompetitor, dan audit akun. Gunakan saat user minta riset/audit performa iklan Meta suatu produk, cek ad fatigue, bandingkan ROAS Meta dengan penjualan Daekan, atau memulai batch kreatif baru.
argument-hint: "<produk> [rentang-tanggal] [ad-account-id]"
---

# 1 · Riset — Meta Ads × Daekan Katalisa

Output tunggal fase ini adalah **`research/latest.md`**. Fase berikutnya (`/daekan-meta-ads:2-strategi`) hanya bisa jalan jika file ini ada dan `status: approved`.

**Kontrak yang mengikat:** `ARCHITECTURE.md` di root plugin (§1.2 fallback, §2 kontrak file, §3 UTM, §5 keamanan). Baca dulu sebelum mulai. Jika ada konflik antara skill ini dan ARCHITECTURE.md, ARCHITECTURE.md yang menang.

Argumen dari user: `$ARGUMENTS`

---

## Langkah 0 — Kumpulkan input

Ambil dari argumen. Tanyakan **sekali, sekaligus** untuk yang belum ada:

| Input | Default | Keterangan |
|---|---|---|
| Produk | — (wajib) | Nama produk di Daekan + slug token `produk` untuk UTM (huruf kecil, `-`), mis. `ebook-ads101` |
| Ad account Meta | Satu-satunya akun aktif | Jika lebih dari satu, tampilkan daftar dari Meta Ads MCP dan minta user memilih |
| Rentang tanggal | 30 hari terakhir s.d. kemarin | Pembanding fatigue: 7 hari terakhir vs 7 hari sebelumnya |
| `batch_id` | `b` + `YYMMDD` hari ini | Tambah sufiks `-2`, `-3` jika `batch_id` hari ini sudah dipakai di `research/archive/` |

## Langkah 1 — Preflight

1. Pastikan **Meta Ads MCP** dan **Daekan Katalisa MCP** tersedia (cek tool yang terdaftar di sesi). Jika salah satu tidak ada, **BERHENTI** dan beri tahu user mana yang belum terhubung (ARCHITECTURE.md §1.2).
2. Lakukan satu panggilan baca ringan ke masing-masing MCP (mis. daftar ad account di Meta, dan cari produk di Daekan) untuk memastikan produk dan akun ditemukan. Jika produk tidak ditemukan di Daekan, tampilkan kandidat terdekat dan minta konfirmasi. **Jangan menebak.**
3. Jika `research/latest.md` sudah ada, salin ke `research/archive/<batch_id-lama>.md` sebelum ditimpa. `batch_id` lama dibaca dari front-matter. Buat folder jika belum ada.

## Langkah 2 — Jalankan subagent `ads-researcher`

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:ads-researcher"`. Jika nama itu tidak dikenali, pakai `"ads-researcher"`. Kirim prompt berikut, dengan semua `<...>` diisi:

```
Jalankan Fase 1 Riset sesuai ARCHITECTURE.md dan instruksi agent-mu.
- Produk (Daekan): <nama produk> | token UTM produk: <slug>
- Ad account Meta: <act_...>
- Rentang analisis: <YYYY-MM-DD> s.d. <YYYY-MM-DD>; pembanding fatigue: 7 hari terakhir vs 7 hari sebelumnya
- batch_id: <bYYMMDD>
Tulis research/latest.md (status: draft) dengan 8 section wajib §2.4, dan WAJIB memuat tiga tabel berikut dengan kolom persis:

1) Di "## Rekonsiliasi Meta ↔ Daekan" — Tabel Performa Meta Ads vs Omzet UTM Daekan:
| utm_campaign | utm_term | utm_content | spend | CTR | CPA Meta | ROAS Meta | order Daekan | omzet Daekan | CPA aktual | ROAS aktual | selisih ROAS |
Baris terakhir = TOTAL. Di bawah tabel: daftar mismatch (UTM tak dikenal, entitas tanpa order, order tanpa UTM, nama melanggar kontrak).

2) Di "## Sinyal Creative Fatigue" — Tabel Kandidat Ad Fatigue:
| ad (utm_content) | frequency | CTR 7h vs 7h sebelumnya | CPM Δ | CPA Δ / ROAS Δ | kriteria terpenuhi | rekomendasi (ganti angle / iterasi hook / pause) |

3) Di "## Riset Kompetitor & Tren (30 hari)" — Tabel Rangkuman Hook Kompetitor:
| kompetitor | hook (verbatim, ≤ 15 kata) | angle | offer | format | lama tayang | sumber |
Lalu 3–5 pola hook yang berulang + celah yang belum dipakai kompetitor.

Jangan mengarang angka: tulis "TIDAK TERSEDIA: <sumber>" bila data tidak ada. Read-only: jangan panggil tool create/update/activate/generate.
```

## Langkah 3 — Validasi output (wajib, jangan dilewati)

Baca `research/latest.md`, lalu periksa:

- [ ] Front-matter lengkap: `batch_id` (sesuai Langkah 0), `phase: research`, `status: draft`, `generated_at`, `generated_by: ads-researcher`, `source_file: null`.
- [ ] Ke-8 heading `##` sesuai ARCHITECTURE.md §2.4, dengan urutan dan teks yang sama persis.
- [ ] Ketiga tabel di atas ada dengan kolom yang diminta. Tabel rekonsiliasi punya baris TOTAL.
- [ ] Setiap angka bisa ditelusuri ke data MCP. Tidak ada placeholder seperti `XX`, `...`, atau `lorem`.
- [ ] Penanda `TIDAK TERSEDIA:` dipakai untuk sumber yang memang tidak tersedia.

Jika ada yang gagal, kirim daftar kekurangannya ke subagent yang sama (SendMessage, atau panggil ulang dengan konteks) untuk diperbaiki. **Maksimal 2 putaran.** Jika masih gagal, laporkan ke user apa yang kurang dan biarkan `status: draft`.

## Langkah 4 — Persetujuan user

Tampilkan ke user, ringkas:
1. Ringkasan eksekutif (3–5 poin).
2. Tabel Performa Meta vs Omzet Daekan: 5 baris teratas berdasarkan spend, plus baris TOTAL.
3. Kandidat ad fatigue beserta rekomendasinya.
4. 3–5 pola hook kompetitor.
5. Daftar `TIDAK TERSEDIA` (jika ada).

Lalu tanyakan: **"Setujui riset ini sebagai dasar batch `<batch_id>`?"**

- **Ya:** ubah front-matter menjadi `status: approved`. Hanya baris itu yang diubah.
- **Tidak / revisi:** catat permintaan user, jalankan ulang bagian terkait lewat subagent, lalu kembali ke Langkah 3.

## Larangan

- DILARANG memanggil tool Meta Ads MCP atau Daekan yang membuat, mengubah, mengaktifkan, menghapus, atau meng-generate apa pun.
- DILARANG mengisi angka sendiri di luar data MCP.
- DILARANG menyetel `status: approved` tanpa jawaban "ya" dari user di percakapan ini.

## Selesai

Laporkan path file dan status. Langkah berikutnya: **`/daekan-meta-ads:2-strategi`**.
