---
name: 2b-landing-page
description: Fase 2B pipeline daekan-meta-ads. Hanya berjalan jika briefs/batch-latest.md sudah approved. Mendelegasikan audit landing page aktif di Daekan Katalisa MCP ke subagent lp-strategist (message-match hook iklan vs above-the-fold, offer & order bump, Meta Pixel & purchase trigger), menampilkan blueprint revisi, lalu—hanya setelah persetujuan eksplisit—membuat/mengedit draf LP di Daekan (status DRAFT) dan mencetak hero image/mockup setelah konfirmasi token. Diakhiri audit creative-qa dan briefs/lp-sync.md berstatus approved.
argument-hint: "[catatan, mis. fokus angle / bagian LP yang ingin direvisi]"
disable-model-invocation: true
---

# 2B · Landing Page Strategis — Message-Match, Offer & Pixel

Output tunggal fase ini adalah **`briefs/lp-sync.md`** dengan `phase: landing-page`, `status: approved`, dan `source_file: briefs/batch-latest.md`. Isinya URL LP bersih, palet/elemen visual, status pixel, dan `## Hasil QA`. File ini dibaca `3-produksi` (opsional) dan **wajib** untuk `4-launch`.

**Kontrak yang mengikat:** `ARCHITECTURE.md` §2.3–§2.5 (gate, section `lp-sync.md`, key machine-readable), §3.2 (`url_tags`), §4.1 (Daekan & token), §5 butir 8–11 (guardrail LP), §6 (quality gate). Baca dulu sebelum mulai.

Catatan dari user: `$ARGUMENTS`

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs <file>`. `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`. Hook PostToolUse juga menjalankannya otomatis setiap kali `briefs/lp-sync.md` disimpan lewat Write/Edit.

---

## Langkah 0 — GATE (wajib, jalankan paling awal)

1. Jika `briefs/batch-latest.md` **tidak ada** atau `status` **bukan `approved`**, **TOLAK** dan berhenti:
   > Fase 2B tidak bisa dijalankan: `briefs/batch-latest.md` belum APPROVED. Selesaikan `/daekan-meta-ads:2-strategi` (QA PASS + persetujuan) terlebih dahulu.
2. Jalankan gate CLI pada `briefs/batch-latest.md`. Jika ada **ERROR**, TOLAK dengan alasan yang sama.
3. Pastikan **Daekan Katalisa MCP** dan **Meta Ads MCP** tersedia. Jika tidak, berhenti (ARCHITECTURE.md §1.2).
4. Ambil `batch_id`, `product_id`, `landing_page_url`, dan `meta_pixel_id` dari `### Produk & Landing Page` di brief.
5. Jika `briefs/lp-sync.md` sudah ada:
   - `batch_id` berbeda → arsipkan ke `briefs/archive/<batch_id-lama>-lp.md`.
   - `batch_id` sama → lanjutkan (resume) dari isinya. Jangan generate ulang aset yang sudah punya URL.

## Langkah 1 — Audit & blueprint oleh `lp-strategist`

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:lp-strategist"` (fallback: `"lp-strategist"`):

```
Jalankan Fase 2B sesuai ARCHITECTURE.md dan instruksi agent-mu (read-only).
- batch_id: <bYYMMDD> | produk Daekan: <product_id / nama> | meta_pixel_id brief: <id>
- Brief: briefs/batch-latest.md (approved)
- Catatan user: <$ARGUMENTS atau "-">
Tulis briefs/lp-sync.md (status: draft) dengan section §2.4 dan key §2.5.
Wajib: tabel Message-Match untuk SETIAP ad_name di brief, message_match_score,
audit offer & order bump vs brief, audit Meta Pixel + purchase trigger (Daekan & dataset Meta),
blueprint revisi berprioritas, palet, dan rencana prompt hero 4:3 / mockup (maks 4, daekan_asset_url = PENDING).
landing_page_url = URL live saat ini, bersih tanpa utm_.
```

Setelah agent selesai, jalankan gate CLI pada `briefs/lp-sync.md`. Jika ada **ERROR**, kirim ke agent untuk diperbaiki. PERINGATAN tentang `## Audit LP Saat Ini` adalah temuan yang wajib ditangani lewat revisi.

## Langkah 2 — Presentasikan rekomendasi ke user

Tampilkan ringkas:
1. **Message-match:** `message_match_score` + tabel `ad_name | hook iklan | above-the-fold LP | skor | gap`.
2. **Offer & order bump:** selisih dengan brief (jika ada) dan penilaian order bump.
3. **Pixel & tracking:** status, `meta_pixel_id`, lokasi event Purchase, dan masalah yang ditemukan.
4. **Blueprint & revisi:** revisi P1/P2/P3, termasuk copy above-the-fold baru.
5. **Rencana aset:** jumlah hero image 4:3 / mockup, rasio, dan kegunaannya.

Lalu ajukan **dua pertanyaan terpisah**:
- **(a)** "Terapkan revisi di atas sebagai **DRAFT** landing page di Daekan? (ya/tidak/ubah)"
- **(b)** "Cetak `<n>` hero image/mockup via Daekan?". Estimasi token ditampilkan di Langkah 3.2 sebelum generate.

Jika user menjawab **tidak** untuk (a), LP live dipakai apa adanya. Lanjut ke Langkah 4, dan QA akan menilai LP live. Jika message-match rendah, sarankan revisi iklan lewat `/daekan-meta-ads:2-strategi` sebagai alternatif.

## Langkah 3 — Eksekusi di Daekan (hanya setelah "ya" eksplisit)

### 3.1 Draf landing page
- Pakai tool **tulis** Daekan Katalisa MCP untuk membuat halaman baru atau mengedit LP produk, **selalu berstatus DRAFT**.
- Terapkan revisi yang disetujui: copy above-the-fold, urutan seksi, offer stack, bukti, garansi, FAQ, CTA, dan order bump jika disetujui.
- Copy baru WAJIB lolos `hooks/policy-terms.json`.
- **DILARANG publish.** Publish hanya jika user memberi perintah eksplisit dan terpisah, mis. "publish LP sekarang". Jika publish dilakukan, catat waktunya.
- Catat di `## Landing Page`:
  - `lp_page_id`
  - `lp_draft_url` (URL preview draf, bersih)
  - `lp_publish_status` (`draft` sampai user mem-publish)
  - `landing_page_url` = URL live/final yang akan dipakai sebagai destination, **bersih tanpa `utm_`**
- Catat di `## Eksekusi Daekan`: apa yang diubah, waktu, dan kutipan konfirmasi user.

### 3.2 Hero image (4:3) & product mockup
1. Tampilkan tabel `# | prompt (ringkas) | rasio | dipakai di seksi LP` (maks 4).
2. Ambil **estimasi token** dari Daekan (tool estimasi/harga). Jika tidak ada, tulis "estimasi tidak tersedia dari Daekan". Tampilkan total dan saldo jika ada.
3. Minta konfirmasi: **"Generate `<n>` gambar via AI Image Generator Daekan dengan estimasi `<x>` token? (ya/tidak)"**. Tanpa "ya", **DILARANG generate**.
4. Generate satu per satu dan simpan di Asset Library Daekan. Gagal = jangan retry otomatis (ARCHITECTURE.md §4.1).
5. Isi `daekan_asset_url` di tabel `## Visual & Palet`. Pasang aset ke draf LP jika revisi (a) disetujui.
6. Baris aset yang **tidak** di-generate (user menolak) dihapus dari tabel dan dipindah ke catatan "rencana tidak dieksekusi". Baris `PENDING` akan menggagalkan gate saat approved.
7. Catat estimasi vs konsumsi token di `## Eksekusi Daekan`.

## Langkah 4 — Verifikasi Meta Pixel & order bump

1. **Daekan (baca):** pixel produk aktif, `meta_pixel_id`, halaman/trigger `Purchase` (halaman sukses bayar / pembayaran terkonfirmasi), `InitiateCheckout`, dan order bump terpasang di checkout sesuai `## Offer & Order Bump`.
2. **Meta Ads MCP (baca):** dataset dengan ID yang sama ada, terhubung ke ad account, dan menerima event 7 hari terakhir (mis. `ads_get_datasets`, `ads_get_dataset_stats`, `ads_get_dataset_quality`).
3. Perbarui `## Pixel & Tracking`. `meta_pixel_status: \`active\`` **hanya** jika keduanya terverifikasi.
4. Jika pixel `inactive` atau `unknown`, laporkan ke user dengan langkah perbaikannya di Daekan. Skill ini tidak mengubah pengaturan pixel. File tidak bisa `approved` sampai pixel aktif, jadi berhenti di sini dengan `status: draft` dan minta user menjalankan ulang skill setelah diperbaiki.

## Langkah 5 — QA, persetujuan & APPROVED

1. Jalankan gate CLI pada `briefs/lp-sync.md`, dan perbaiki semua **ERROR**.
2. Panggil **Agent** `daekan-meta-ads:creative-qa` (fallback: `creative-qa`):
   ```
   Mode landing page. Review briefs/lp-sync.md terhadap briefs/batch-latest.md dan hooks/policy-terms.json.
   Peringatan quality gate yang wajib kamu cek: <tempel PERINGATAN, atau "tidak ada">
   ```
   Tempel hasilnya apa adanya ke `## Hasil QA`.
3. **REVISE / FAIL:**
   - Masalah copy/blueprint → kembali ke `lp-strategist` untuk revisi.
   - Perubahan draf di Daekan → **wajib konfirmasi user lagi** (Langkah 3).
   - Gambar baru → estimasi & konfirmasi token lagi.
   - Maksimal 3 putaran. Setelah itu set `status: rejected`, tampilkan temuan, dan minta arahan.
4. **PASS:**
   - Tampilkan ringkasan final: `landing_page_url`, `lp_publish_status`, `message_match_score`, status pixel, aset hero/mockup, dan palet.
   - Tanyakan: **"Setujui landing page batch `<batch_id>`?"**
   - Jika ya, set `status: approved`, lalu jalankan gate CLI sekali lagi. Gate menolak jika `Verdict batch: PASS` tidak ada, pixel bukan `active`, atau URL mengandung `utm_`.
5. Jika `lp_publish_status` masih `draft`, ingatkan user bahwa LP wajib di-publish (oleh user, atau atas perintah eksplisitnya) sebelum `/daekan-meta-ads:4-launch`.

## Larangan (ARCHITECTURE.md §5 butir 8–11)

- DILARANG membuat/mengedit LP tanpa "ya" eksplisit, dan DILARANG publish tanpa perintah publish yang eksplisit.
- DILARANG generate hero/mockup tanpa estimasi token + konfirmasi, atau lebih dari 4 gambar.
- DILARANG menulis URL dengan `utm_` di `briefs/lp-sync.md`. UTM hanya lewat `url_tags` di Fase 4.
- DILARANG mengubah pengaturan Meta Pixel, dataset, atau entitas Meta Ads.
- DILARANG menyetel `status: approved` tanpa QA PASS, pixel `active`, dan "ya" dari user.

## Selesai

Laporkan path file, `message_match_score`, status pixel, status publish LP, dan token terpakai. Langkah berikutnya: **`/daekan-meta-ads:3-produksi`**. Fase 3 akan memakai palet & aset LP ini, dan `/daekan-meta-ads:4-launch` mewajibkan file ini approved.
