---
name: 2-landing-page
description: Fase 2 pipeline daekan-meta-ads. Hanya berjalan jika research/latest.md sudah approved. Subagent lp-strategist (read-only) mengaudit landing page aktif di Daekan Katalisa MCP lalu menetapkan 2–4 Janji Utama LP yang akan diikuti semua iklan, mengecek offer, order bump, dan Meta Pixel, menyusun blueprint revisi, palet, serta kebutuhan visual LP (hero/mockup sebagai brief untuk Designer, tidak di-generate). Revisi diterapkan sebagai DRAFT di Daekan hanya setelah persetujuan eksplisit. Diakhiri audit creative-qa dan briefs/lp-sync.md berstatus approved.
argument-hint: "[catatan, mis. bagian LP yang ingin direvisi]"
disable-model-invocation: true
---

# 2 · Landing Page — Janji Utama, Offer & Pixel

Output tunggal fase ini adalah **`briefs/lp-sync.md`** (`phase: landing-page`, `status: approved`, `source_file: research/latest.md`). Isinya:
- `landing_page_url` bersih;
- **Janji Utama LP** (dasar message-match iklan);
- palet/font;
- kebutuhan visual LP;
- status pixel;
- `## Hasil QA`.

File ini **wajib** untuk `/daekan-meta-ads:3-creative-brief` dan `/daekan-meta-ads:5-launch`.

**Kontrak yang mengikat:** `ARCHITECTURE.md` §2.3–§2.5, §3.2, §5 (butir 5, 6, 9, 10), §6. Baca dulu sebelum mulai.

Catatan dari user: `$ARGUMENTS`

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs <file>`. `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`. Hook PostToolUse juga menjalankannya otomatis setiap kali file di `briefs/` disimpan.

---

## Langkah 0 — GATE (wajib, jalankan paling awal)

1. Jika `research/latest.md` **tidak ada** atau `status` **bukan `approved`**, **TOLAK** dan berhenti:
   > Fase 2 tidak bisa dijalankan: `research/latest.md` belum APPROVED. Jalankan `/daekan-meta-ads:1-riset <produk>` dan setujui hasilnya terlebih dahulu.
2. Pastikan **Daekan Katalisa MCP** dan **Meta Ads MCP** tersedia. Jika tidak, berhenti (§1.2).
3. `batch_id` batch ini:
   - default `b` + `YYMMDD` hari ini, ditambah sufiks `-2`, `-3`, … jika sudah dipakai di `briefs/archive/`;
   - jika `briefs/lp-sync.md` sudah ada dengan `batch_id` lain, arsipkan dulu ke `briefs/archive/<batch_id-lama>-lp.md`;
   - jika `batch_id`-nya sama, lanjutkan (resume) dari isinya.

## Langkah 1 — Audit & janji utama oleh `lp-strategist`

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:lp-strategist"` (fallback: `"lp-strategist"`):

```
Jalankan Fase 2 Landing Page sesuai ARCHITECTURE.md dan instruksi agent-mu (read-only).
- batch_id: <bYYMMDD> | produk Daekan: <nama/ID dari research/latest.md>
- Input riset: research/latest.md (approved)
- Catatan user: <$ARGUMENTS atau "-">
Tulis briefs/lp-sync.md (status: draft) dengan section §2.4 dan key §2.5:
audit LP saat ini (verbatim), 2–4 Janji Utama LP berbasis bukti riset, offer & order bump,
blueprint revisi berprioritas, Visual & Palet (hex + font), Kebutuhan Visual LP (brief hero 4:3 /
mockup untuk Designer — JANGAN generate), dan Pixel & Tracking.
landing_page_url = URL live saat ini, bersih tanpa utm_.
```

Setelah agent selesai, jalankan gate CLI pada `briefs/lp-sync.md`. Kirim setiap ERROR ke agent untuk diperbaiki. PERINGATAN tentang `## Audit LP Saat Ini` adalah temuan yang ditangani lewat revisi.

## Langkah 2 — Presentasikan ke user

Tampilkan ringkas:
1. **Janji Utama LP** (2–4) beserta bukti riset di baliknya.
2. **Audit above-the-fold**: apa yang sudah/belum menyampaikan janji tersebut.
3. **Offer & order bump**: temuan dan saran.
4. **Pixel & tracking**: status, lokasi event Purchase, dan masalah yang ditemukan.
5. **Revisi P1/P2/P3**, termasuk copy above-the-fold baru.
6. **Kebutuhan visual LP**: daftar hero/mockup yang akan masuk ke brief Designer di Fase 3.

Lalu tanyakan:
- **(a)** "Setujui Janji Utama LP ini sebagai dasar semua iklan batch `<batch_id>`?" Ini wajib sebelum approve.
- **(b)** "Terapkan revisi di atas sebagai **DRAFT** landing page di Daekan? (ya/tidak/ubah)"

Jika (b) dijawab tidak, LP live dipakai apa adanya dan janji utama harus sesuai dengan yang sudah tampil di LP live.

## Langkah 3 — Draf di Daekan (hanya setelah "ya" eksplisit untuk (b))

- Pakai tool **tulis** Daekan, mis. `edit_landing_page` / `update_landing_page` dengan `status: "draft"`, atau `duplicate_landing_page` untuk membuat salinan draf. Halaman yang diedit **selalu berstatus DRAFT**.
- Terapkan revisi yang disetujui. Copy baru WAJIB lolos `hooks/policy-terms.json`.
- **DILARANG publish.** `publish_landing_page` hanya boleh dipanggil jika user memberi perintah publish yang eksplisit dan terpisah, mis. "publish LP sekarang".
- **DILARANG generate gambar** (`generate_hero_image`, `generate_product_mockup`, `generate_ai_images`). Kebutuhan visual tetap ditulis sebagai brief untuk Designer.
- Catat:
  - di `## Landing Page`: `lp_page_id`, `lp_draft_url` (bersih), `lp_publish_status` (`draft` sampai user publish), dan `landing_page_url` (URL live/final yang akan menjadi destination);
  - di `## Eksekusi Daekan`: perubahan, waktu, dan kutipan konfirmasi user.

## Langkah 4 — Verifikasi Meta Pixel & order bump

1. **Daekan (baca):** mis. `get_landing_page_pixels`, `get_product_pixels`, `list_bumps`. Pastikan pixel aktif, `Purchase` di halaman sukses bayar, `InitiateCheckout` tercatat, dan order bump terpasang sesuai `## Offer & Order Bump`.
2. **Meta Ads MCP (baca):** dataset dengan ID yang sama terhubung ke ad account dan menerima event 7 hari terakhir.
3. Perbarui `## Pixel & Tracking`. `meta_pixel_status: \`active\`` **hanya** jika keduanya terverifikasi.
4. Jika pixel `inactive`/`unknown`: laporkan langkah perbaikannya di Daekan, lalu berhenti dengan `status: draft`. Skill ini tidak mengubah pengaturan pixel.

## Langkah 5 — QA, persetujuan & APPROVED

1. Jalankan gate CLI pada `briefs/lp-sync.md` dan perbaiki semua **ERROR**.
2. Panggil **Agent** `daekan-meta-ads:creative-qa` (fallback: `creative-qa`):
   ```
   Mode landing page. Review briefs/lp-sync.md terhadap research/latest.md dan hooks/policy-terms.json.
   Peringatan quality gate yang wajib kamu cek: <tempel PERINGATAN, atau "tidak ada">
   ```
   Tempel hasilnya ke `## Hasil QA`.
3. **REVISE / FAIL:**
   - kembali ke `lp-strategist`;
   - perubahan draf di Daekan wajib konfirmasi user lagi;
   - maksimal 3 putaran, setelah itu set `status: rejected` dan minta arahan.
4. **PASS:** tampilkan ringkasan final, lalu tanyakan **"Setujui landing page batch `<batch_id>`?"**. Jika ya, set `status: approved` lalu jalankan gate CLI sekali lagi. Gate menolak jika tidak ada PASS, pixel tidak aktif, janji < 2, atau URL mengandung `utm_`.
5. Jika `lp_publish_status` masih `draft`, ingatkan bahwa LP wajib di-publish sebelum `/daekan-meta-ads:5-launch`.

## Larangan
- DILARANG membuat/mengedit LP tanpa "ya" eksplisit, dan DILARANG publish tanpa perintah publish yang eksplisit.
- DILARANG men-generate gambar apa pun; hero/mockup hanya ditulis sebagai kebutuhan untuk Designer.
- DILARANG menulis URL dengan `utm_` di `briefs/`.
- DILARANG mengubah pengaturan Meta Pixel, dataset, atau entitas Meta Ads.
- DILARANG `status: approved` tanpa QA PASS, pixel `active`, dan "ya" dari user.

## Selesai
Laporkan path file, Janji Utama LP, status pixel, dan status publish LP. Langkah berikutnya: **`/daekan-meta-ads:3-creative-brief`**.
