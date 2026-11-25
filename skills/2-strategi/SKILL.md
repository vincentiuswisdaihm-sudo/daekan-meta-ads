---
name: 2-strategi
description: Fase 2 pipeline daekan-meta-ads. Hanya berjalan jika research/latest.md sudah ada dan approved. Mengekstrak brief & detail offer dari landing page produk di Daekan Katalisa MCP, menjalankan subagent creative-strategist untuk variasi konsep static ad dan video ad, lalu wajib lolos audit creative-qa sebelum briefs/batch-latest.md diset approved. Gunakan saat user minta menyusun angle, hook, copy, atau brief kreatif batch iklan Meta berikutnya.
argument-hint: "[catatan tambahan, mis. fokus angle / offer khusus]"
---

# 2 · Strategi — Brief Kreatif Batch

Output tunggal fase ini adalah **`briefs/batch-latest.md`** dengan `status: approved`. Status ini hanya boleh dipasang setelah `creative-qa` memberi **Verdict batch: PASS** dan user menyetujui.

**Kontrak yang mengikat:** `ARCHITECTURE.md` (§2 kontrak file & format machine-readable, §3 UTM, §4 dual-engine, §6 quality gate). Baca dulu sebelum mulai.

Catatan tambahan dari user: `$ARGUMENTS`

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs <file>`. `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`. Hook PostToolUse plugin juga menjalankannya otomatis setiap kali file di `briefs/` disimpan lewat Write/Edit.

---

## Langkah 0 — GATE (wajib, jalankan paling awal)

1. Jika **`research/latest.md` tidak ada**, **TOLAK** dan berhenti dengan pesan:
   > Fase 2 tidak bisa dijalankan: `research/latest.md` belum ada. Jalankan `/daekan-meta-ads:1-riset <produk>` terlebih dahulu.
2. Baca front-matter-nya. Jika `status` bukan `approved`, tampilkan ringkasan eksekutifnya dan tanya user apakah riset disetujui. Hanya jika user menjawab **ya** di percakapan ini, ubah ke `status: approved` lalu lanjut. Jika tidak, berhenti.
3. Ambil `batch_id` dan produk dari riset. Batch ini WAJIB memakai `batch_id` yang sama.
4. Jika `briefs/batch-latest.md` sudah ada dengan `batch_id` berbeda, salin ke `briefs/archive/<batch_id-lama>-batch.md` sebelum ditimpa.

## Langkah 1 — Ekstrak brief & offer dari landing page Daekan

Gunakan tool **baca** Daekan Katalisa MCP. Cari berdasarkan fungsi: detail produk, halaman/landing page produk, checkout, pengaturan pixel. Kumpulkan **Brief Produk**:

| Field | Sumber | Catatan |
|---|---|---|
| `product_id`, `product_name` | Produk Daekan | |
| `landing_page_url` | LP produk di Daekan | URL bersih, **tanpa** parameter UTM |
| Headline & sub-headline LP | Konten LP | Verbatim |
| Harga normal / harga promo / periode promo | Produk / checkout | Angka persis |
| Value stack: modul, bonus, format delivery | Konten LP | |
| Garansi / risk reversal | Konten LP | Verbatim |
| Testimoni / social proof | Konten LP | Verbatim + nama/inisial. Tandai jika tanpa bukti |
| FAQ & objection utama | Konten LP | |
| CTA LP | Konten LP | |
| `meta_pixel_id` | Pengaturan pixel produk | Untuk Fase 4 |

Aturan:
- Jika Daekan tidak mengembalikan konten LP (hanya data produk), tampilkan field yang kosong ke user dan minta dikonfirmasi. **DILARANG menebak harga, bonus, garansi, atau testimoni.**
- Tandai klaim LP yang berisiko policy (mis. klaim penghasilan). Klaim tersebut **tidak boleh** dibawa ke copy iklan.

## Langkah 2 — Jalankan subagent `creative-strategist`

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:creative-strategist"` (fallback: `"creative-strategist"`). Prompt:

```
Jalankan Fase 2 Strategi sesuai ARCHITECTURE.md dan instruksi agent-mu.
- Input riset: research/latest.md (approved), batch_id: <bYYMMDD>
- Brief Produk dari LP Daekan (gunakan verbatim, jangan ubah harga/offer):
<tempel tabel Brief Produk dari Langkah 1>
- Catatan user: <$ARGUMENTS atau "-">

Wajib menghasilkan variasi:
- STATIC AD: minimal 2 konsep (format img11 / img45 / img916 / car).
- VIDEO AD: minimal 2 konsep; setiap konsep video dibuat dalam DUA format: vid916 (Reels/Stories) dan vid45 (Feed), masing-masing dengan ad_name sendiri.
- Setiap konsep: minimal 2 hook (h1, h2, ...), primary text pendek & panjang, headline ≤ 40, description ≤ 30, CTA.
- Total prompt gambar Daekan ≤ 4 untuk SELURUH batch. Gambar dipakai bersama oleh static ad dan sebagai visual scene video.

Tulis briefs/batch-latest.md (status: draft) dengan format machine-readable ARCHITECTURE.md §2.5:
- "### Produk & Landing Page" di bawah "## Ringkasan Batch" berisi field Brief Produk (key: value).
- "## Struktur Kampanye": baris `- utm_campaign: \`...\`` dan `- utm_term: \`...\`` untuk setiap entitas.
- "## Konsep Kreatif": satu "### Konsep n" per ad, diawali baris `- ad_name: \`...\``.
- "## Prompt Visual Daekan": satu heading "### Prompt n" per gambar (maks 4), beserta ad_name tujuan & rasio.
- "## Hasil QA": isi PENDING.
```

## Langkah 3 — Quality gate mekanis

Jalankan gate CLI pada `briefs/batch-latest.md`. Hook juga akan memberi umpan balik otomatis saat file disimpan.
- **ERROR:** kirim daftar error ke `creative-strategist` untuk diperbaiki, lalu ulangi gate sampai lolos.
- **PERINGATAN:** teruskan ke `creative-qa` di Langkah 4 sebagai fokus pemeriksaan.

## Langkah 4 — Audit `creative-qa` (wajib lolos)

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:creative-qa"` (fallback: `"creative-qa"`):

```
Mode brief. Review briefs/batch-latest.md terhadap research/latest.md sesuai rubrik-mu.
Peringatan quality gate yang wajib kamu cek: <tempel PERINGATAN, atau "tidak ada">
```

Tempel output QA apa adanya ke section `## Hasil QA` (gantikan `PENDING`).

- **PASS:** lanjut ke Langkah 5.
- **REVISE / FAIL:** kirim seluruh **Temuan** ke `creative-strategist` untuk revisi, ulangi Langkah 3 → Langkah 4. **Maksimal 3 putaran.** Jika putaran ke-3 masih belum PASS, **BERHENTI**: set `status: rejected`, tampilkan temuan yang tersisa ke user, dan minta arahan.

## Langkah 5 — Persetujuan user & APPROVED

Tampilkan ke user:
1. Tabel ringkas: `ad_name | tipe (static/video) | angle | hook utama | format`.
2. Offer final dan landing page URL.
3. Daftar prompt Daekan (≤ 4) dengan rasio.
4. Verdict QA.

Tanyakan: **"Setujui batch `<batch_id>` untuk produksi?"**
- **Ya:** ubah front-matter menjadi `status: approved`, lalu jalankan gate CLI sekali lagi. Gate akan menolak `approved` jika `## Hasil QA` belum berisi `Verdict batch: PASS`. Hasilnya harus lolos tanpa ERROR.
- **Revisi:** kembali ke Langkah 2 dengan catatan user.

## Larangan

- DILARANG men-generate gambar/video atau menyentuh Meta Ads di fase ini.
- DILARANG menulis `status: approved` sebelum QA PASS **dan** "ya" dari user.
- DILARANG memasukkan UTM ke `landing_page_url`.

## Selesai

Laporkan path file, jumlah konsep static/video, dan status. Langkah berikutnya: **`/daekan-meta-ads:2b-landing-page`** (selaraskan landing page, wajib sebelum launch), lalu **`/daekan-meta-ads:3-produksi`**.
