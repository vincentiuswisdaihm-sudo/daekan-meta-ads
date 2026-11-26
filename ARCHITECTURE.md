# ARCHITECTURE — `daekan-meta-ads`

Dokumen ini adalah **kontrak** plugin. Semua subagent (`agents/`) dan skill (`skills/`) WAJIB mematuhinya. Jika ada instruksi lain yang bertentangan dengan dokumen ini, dokumen ini yang menang, kecuali user memberi perintah eksplisit di percakapan.

Kata **WAJIB**, **DILARANG**, dan **BOLEH** dipakai dalam arti normatif.

---

## 1. Ikhtisar & Dependensi

Plugin ini **tidak memproduksi aset**. Tugasnya menghasilkan **Creative Brief** yang lengkap dan approved, lalu menerima kembali aset hasil produksi luar dan me-launch-nya dalam status PAUSED.

```
1 RISET ──► 2 LANDING PAGE ──► 3 CREATIVE BRIEF ══► [ produksi di luar plugin ] ══► 4 TERIMA ASET ──► 5 LAUNCH
research/   briefs/            briefs/creative-brief.md   Video Editor / Designer    briefs/          reports/
latest.md   lp-sync.md         briefs/handoff/*.json      (plugin/agent lain)        assets-ready.md  launch-log.md
```

- **Produksi baru boleh dimulai setelah SELURUH Creative Brief batch approved.** Paket handoff yang belum approved tidak boleh dikirim ke Video Editor/Designer.
- Plugin ini **tidak men-generate gambar maupun video**, termasuk hero image dan mockup landing page. Semua kebutuhan visual ditulis sebagai item brief untuk Designer.

### 1.1 Dependensi

| Dependensi | Jenis | Dipakai untuk |
|---|---|---|
| **Meta Ads MCP** | MCP server (sudah aktif di environment user) | Baca performa & fatigue; launch campaign/ad set/creative/ad (selalu PAUSED) |
| **Daekan Katalisa MCP** | MCP server (sudah aktif di environment user) | Order & penjualan per UTM; produk, landing page (draf), Meta Pixel, order bump; brief visual LP (read-only) |
| `marketing-skills-core` (`product-marketing`, `ad-creative`, `offers`, `cro`, `copywriting`) | **Dependensi plugin (otomatis)**, subset dari `coreyhaines31/marketingskills` | Kerangka angle, offer, CRO, dan copy |
| `ui-ux-pro-max-core` (`ui-ux-pro-max`, `design-system`) | **Dependensi plugin (otomatis)**, subset dari `nextlevelbuilder/ui-ux-pro-max-skill` | Struktur seksi & design system landing page |
| `last30days` | **Dependensi plugin (otomatis)**, plugin utuh dari `mvanhorn/last30days-skill` | Riset kompetitor & tren 30 hari terakhir |
| `references/claude-ads/meta-audit.md` | **Referensi dibundel**, dari `AgriciDaniel/claude-ads` | Katalog kontrol audit Meta Ads (read-only) |
| `references/agency-agents/*.md` (`Ad Creative Strategist`, `Image Prompt Engineer`) | **Referensi dibundel**, dari `msitarzewski/agency-agents` | Standar kualitas copy & arahan visual di brief |

Semua komponen pihak ketiga berlisensi MIT dan di-pin ke commit tertentu (lihat `THIRD_PARTY_NOTICES.md`). Dependensi didaftarkan di `.claude-plugin/marketplace.json` lalu dideklarasikan di `dependencies` pada `plugin.json`, sehingga `claude plugin install daekan-meta-ads` memasang semuanya sekaligus. Hanya **subset skill yang dipakai pipeline** yang dipasang (~1.200 token always-on untuk seluruh dependensi).

**Guardrail §5 berlaku juga atas skill dependensi dan referensi.** Tidak ada skill atau referensi pihak ketiga yang boleh dipakai untuk mengubah, mempublikasikan, atau mengaktifkan entitas Meta Ads, men-generate aset, atau mempublikasikan landing page.

Plugin ini **tidak** menyertakan `.mcp.json`. Kedua MCP server sudah dikonfigurasi di environment user, dan konfigurasi duplikat akan bentrok.

### 1.2 Aturan fallback

- Nama tool MCP bisa berbeda antar environment. Contoh nama tool ditulis di skill, tetapi subagent mencari tool berdasarkan **fungsinya** jika nama itu tidak ada.
- Jika MCP, skill dependensi (mis. dinonaktifkan user, atau butuh API key yang belum diset), atau file referensi tidak tersedia, subagent WAJIB menulis `TIDAK TERSEDIA: <nama>` di section terkait pada file output, lalu melanjutkan dengan data yang ada. **DILARANG mengarang angka, order, atau data kompetitor.**
- Jika **Meta Ads MCP** atau **Daekan Katalisa MCP** tidak tersedia, fase yang bergantung padanya WAJIB berhenti dan melapor ke user.

---

## 2. Pipeline & Kontrak File antar-Fase

### 2.1 Peta fase

| Fase | File output | Penulis | Gate QA | Pembaca berikutnya |
|---|---|---|---|---|
| 1. Riset | `research/latest.md` | `ads-researcher` | persetujuan user | Fase 2, Fase 3 |
| 2. Landing Page | `briefs/lp-sync.md` | `lp-strategist` (audit/blueprint) + skill (draf Daekan setelah konfirmasi) | `creative-qa` (mode landing page) | Fase 3, Fase 5 |
| 3. Creative Brief | `briefs/creative-brief.md` + `briefs/handoff/` | `creative-strategist` | `creative-qa` (mode brief) | **Video Editor / Designer (luar plugin)**, Fase 4, Fase 5 |
| 4. Terima Aset | `briefs/assets-ready.md` | skill `4-terima-aset` | `creative-qa` (mode aset) | Fase 5 |
| 5. Launch | `reports/launch-log.md` | skill `5-launch` (Meta Ads MCP) | — | `ads-researcher` (siklus berikutnya) |

### 2.2 Front-matter wajib (semua file kontrak `.md`)

```yaml
---
batch_id: b261126            # format bYYMMDD, lihat §3.4
phase: research | landing-page | creative-brief | asset-intake | launch
status: draft | approved | rejected
generated_at: 2026-11-26T10:00:00+07:00   # ISO 8601
generated_by: lp-strategist               # nama subagent/skill penulis
source_file: research/latest.md           # file input fase sebelumnya (null untuk Fase 1)
---
```

`source_file` WAJIB:
- `lp-sync.md` → `research/latest.md`
- `creative-brief.md` → `briefs/lp-sync.md`
- `assets-ready.md` → `briefs/creative-brief.md`

### 2.3 Aturan gate

1. Fase berikutnya **DILARANG** dimulai jika file wajibnya tidak ada, `batch_id`-nya berbeda, atau `status != approved`:

   | Fase | Wajib approved (`batch_id` sama) |
   |---|---|
   | 2 Landing Page | `research/latest.md` |
   | 3 Creative Brief | `research/latest.md` + `briefs/lp-sync.md` |
   | Produksi luar | `briefs/creative-brief.md` + **semua** `briefs/handoff/*.json` |
   | 4 Terima Aset | `briefs/creative-brief.md` |
   | 5 Launch | `briefs/assets-ready.md` + `briefs/lp-sync.md` (Pixel aktif, LP published) |

2. `status: approved` pada `lp-sync.md`, `creative-brief.md`, dan `assets-ready.md` hanya boleh di-set setelah `creative-qa` memberi **Verdict batch: PASS** **dan** user menyetujui. Syarat tambahan:
   - `lp-sync.md`: `meta_pixel_status: active` dan 2–4 janji di `## Janji Utama LP`.
   - `creative-brief.md`: semua JSON handoff ber-`status: approved`. Status ini dipasang bersamaan, dan hanya setelah brief disetujui.
3. `research/latest.md` boleh di-set `approved` oleh user setelah membaca ringkasannya.
4. **Arsip:** sebelum menimpa file kontrak dari batch lain, salin versi lama ke `<dir>/archive/` (mis. `briefs/archive/b261118-lp.md`, `briefs/archive/b261118-brief.md`, `briefs/archive/b261118-handoff/`, `briefs/archive/b261118-assets.md`, `research/archive/b261118.md`).
5. `reports/launch-log.md` bersifat **append-only**. Setiap launch menambah satu section `## <batch_id> — <tanggal>`. Entri lama DILARANG diubah.

### 2.4 Section wajib per file

**`research/latest.md`** (Fase 1)
1. `## Ringkasan Eksekutif`: 3–5 temuan utama + rekomendasi.
2. `## Performa Meta Ads`: tabel per campaign/ad set/ad: spend, impresi, CTR, CPM, CPC, CPA, ROAS (versi Meta), frequency.
3. `## Sinyal Creative Fatigue`: **Tabel Kandidat Ad Fatigue** dengan kolom `ad (utm_content) | hook | frequency | CTR 7h vs 7h sebelumnya | CPM Δ | CPA Δ / ROAS Δ | kriteria terpenuhi | rekomendasi`. Kolom `hook` dipakai untuk cek anti-similarity di Fase 3.
4. `## Penjualan per UTM (Daekan Katalisa)`: tabel order, revenue, dan konversi per triple UTM.
5. `## Rekonsiliasi Meta ↔ Daekan`: **Tabel Performa Meta Ads vs Omzet UTM Daekan** (`utm_campaign | utm_term | utm_content | spend | CTR | CPA Meta | ROAS Meta | order Daekan | omzet Daekan | CPA aktual | ROAS aktual | selisih ROAS`, plus baris TOTAL), lalu daftar mismatch.
6. `## Riset Kompetitor & Tren (30 hari)`: **Tabel Rangkuman Hook Kompetitor** (`kompetitor | hook (verbatim, ≤ 15 kata) | angle | offer | format | lama tayang | sumber`).
7. `## Audit Checklist`: hasil evaluasi katalog `references/claude-ads/meta-audit.md` (✅ / ⚠️ / ❌ / `unknown` + bukti).
8. `## Peluang & Hipotesis untuk Batch Berikutnya`: kandidat angle beserta buktinya, menjadi bahan long-list Fase 3.

**`briefs/lp-sync.md`** (Fase 2)
1. `## Landing Page`: `product_id`, `landing_page_url` (URL live = destination; **bersih tanpa UTM**), `lp_page_id`, `lp_publish_status` (`published` | `draft`), `lp_draft_url` (jika ada draf revisi).
2. `## Audit LP Saat Ini`: snapshot LP live, verbatim: headline & sub-headline above-the-fold, CTA, struktur seksi, offer, dan klaim berisiko.
3. `## Janji Utama LP`: **2–4 janji** (bullet) yang dijanjikan LP final. Setiap iklan di Fase 3 WAJIB meneruskan salah satunya (message-match).
4. `## Offer & Order Bump`: harga normal/promo, value stack, bonus, garansi, testimoni (verbatim), `order_bump`.
5. `## Blueprint & Revisi LP`: struktur seksi (hero → problem → solusi → offer stack → bukti → garansi → FAQ → CTA), copy above-the-fold, dan daftar revisi berprioritas.
6. `## Visual & Palet`: token warna (hex), font, dan gaya visual. Ini sumber `brand` untuk semua JSON handoff.
7. `## Kebutuhan Visual LP`: kebutuhan hero image (4:3) / product mockup sebagai **item brief untuk Designer** (diperkaya `extract_hero_image_brief` / `extract_product_mockup_brief`, read-only). Tidak di-generate di fase ini; di Fase 3 menjadi `handoff/<batch_id>_lp-hero_v1.json` dan sejenisnya.
8. `## Pixel & Tracking`: `meta_pixel_id`, `meta_pixel_status` (`active` | `inactive` | `unknown`), `purchase_event`, `initiate_checkout`, kecocokan dengan dataset Meta.
9. `## Eksekusi Daekan`: log tindakan di Daekan (draf dibuat/diedit, selalu DRAFT; publish hanya atas perintah eksplisit user) dan konfirmasi user.
10. `## Hasil QA`.

**`briefs/creative-brief.md`** (Fase 3, master brief)
1. `## Ringkasan Strategi`: tujuan batch, produk, offer, anggaran indikatif, `landing_page_url`.
2. `## Seleksi Konsep`: long-list kandidat angle dengan **skor relevansi 1–5** pada 4 dimensi (bukti data, kecocokan janji LP, kekuatan pain/desire, kebaruan vs fatigue), lalu konsep terpilih (default 3–5).
3. `## Diversity Matrix`: tabel `concept_id | angle | persona | hook_type | format | visual_world | emotional_tone | offer_framing` (§4.2).
4. `## Struktur Kampanye`: `utm_campaign` dan `utm_term`.
5. `## Daftar Aset`: tabel `ad_name | concept_id | tipe | penerima | format | angle | hook`. Aset LP (`<batch_id>_lp-hero_v1`, …) dicantumkan juga.
6. `## Konsep Kreatif`: satu `### Konsep <x> — <concept_id>` per konsep, berisi baris `- ad_name: \`...\`` untuk tiap varian format, angle, janji LP yang diteruskan, hook, ringkasan storyboard/layout, dan kriteria approval.
7. Untuk **setiap `ad_name`**, satu blok `### Copy Meta — <ad_name>` yang siap copy-paste (§4.3).
8. `## Konsep Tidak Dipilih`: kandidat yang gugur beserta alasannya. Section ini tidak divalidasi sebagai aset.
9. `## Hasil QA`.

**`briefs/handoff/`** (Fase 3, paket produksi)
- `<asset_id>.json`: satu file per aset, sesuai `schemas/creative-brief.schema.json` (§4).
- `video-editor.md` dan `designer.md`: paket per penerima, siap ditempel ke plugin/agent lain. Isinya header `READY FOR PRODUCTION — batch <id>` (hanya bila approved), instruksi umum, daftar aset, ringkasan spesifikasi, path JSON, aturan nama file, dan cara mengembalikan aset.
- `index.json`: `{ "batch_id", "status", "assets": [{ "asset_id", "recipient", "asset_type", "file": "<asset_id>.json" }] }`.

**`briefs/assets-ready.md`** (Fase 4)
1. `## Manifest Aset`: tabel `asset_id | recipient | file | ratio | size | duration | status`. Satu baris per `asset_id` di `handoff/`; `status` ∈ `pending | ready | revise | failed`.
2. `## Catatan Revisi`: per aset yang `revise`, berisi temuan & instruksi perbaikan untuk dikirim balik ke Video Editor/Designer.
3. `## Hasil QA`.

**`reports/launch-log.md`** (Fase 5, append-only)
Front-matter dibuat saat file pertama kali ditulis; setelahnya hanya `batch_id` dan `generated_at` yang boleh diperbarui. Per batch, satu section `## <batch_id> — <tanggal>`:
1. Tabel `level | nama (= nilai UTM) | meta_id | status | created_at`. Kolom status WAJIB `PAUSED`.
2. URL tujuan final lengkap dengan `url_tags` (§3.2).
3. Verifikasi pasca-create.
4. Catatan aktivasi.

### 2.5 Format machine-readable (dibaca quality gate §6)

- **UTM** ditulis sebagai deklarasi key-value dengan nilai di dalam backtick (`- utm_campaign: \`...\``, `- utm_term: \`...\``, `- ad_name: \`...\``), atau sebagai kolom tabel dengan header persis `ad_name`, `utm_content`, `utm_campaign`, atau `utm_term`. Pola contoh yang memakai `{...}`/`<...>` dan placeholder (`PENDING`, `-`, `n/a`) tidak divalidasi.
- Di **`lp-sync.md`**, key berikut WAJIB ditulis sebagai deklarasi key-value: `landing_page_url`, `lp_publish_status`, `meta_pixel_id`, `meta_pixel_status`.
- Di **`creative-brief.md`**, blok Copy Meta ditulis sebagai teks polos:
  ```text
  ### Copy Meta — b261126_time-pain_h1_vid916_v1
  Primary text: Masih 3 jam riset iklan tiap minggu? Template ini memangkasnya jadi 30 menit.
  Primary text (panjang): (opsional) versi panjang di bawah "See more"
  Headline: Riset Iklan Selesai 30 Menit
  Description: Ebook + 50 template
  CTA: LEARN_MORE
  URL: https://toko.daekan.id/ebook-ads101
  ```

---

## 3. Kontrak Penamaan UTM

### 3.1 Prinsip

> **Nama entitas Meta == nilai UTM.**
> Nama campaign = `utm_campaign`, nama ad set = `utm_term`, nama ad = `utm_content`.

Dengan prinsip ini, URL parameter dinamis Meta otomatis mengisi UTM dari nama entitas. Data performa dari Meta Ads MCP dan laporan penjualan UTM di Daekan Katalisa MCP bisa di-join tanpa tabel mapping manual.

### 3.2 `url_tags` standar (WAJIB di setiap ad)

```
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}
```

| Parameter | Nilai | Catatan |
|---|---|---|
| `utm_source` | `{{site_source_name}}` | Diisi Meta: `fb`, `ig`, `msg`, `an` |
| `utm_medium` | `paid_social` | Konstan |
| `utm_campaign` | `{{campaign.name}}` | Lihat §3.3 |
| `utm_term` | `{{adset.name}}` | Lihat §3.3 |
| `utm_content` | `{{ad.name}}` | Lihat §3.3 |

`url_tags` dipasang di field URL parameters pada creative/ad, **bukan** di-hardcode ke link landing page.

### 3.3 Pola nama

| UTM | Level Meta | Pola | Contoh |
|---|---|---|---|
| `utm_campaign` | Campaign | `{produk}_{objektif}_{funnel}_{yyyymmdd}` | `ebook-ads101_sales_tof_20261125` |
| `utm_term` | Ad set | `{audiens}_{geo}_{placement}` | `lal1-buyers_id_advplus` |
| `utm_content` | Ad | `{batch_id}_{angle}_{hook}_{format}_v{n}` | `b261125_pain-time_h2_vid916_v1` |

### 3.4 Aturan sintaks

- Hanya huruf kecil `a-z`, angka `0-9`, `-` (pemisah **di dalam** token), dan `_` (pemisah **antar** token).
- Regex validasi (berlaku untuk ketiga nilai):

  ```
  ^[a-z0-9-]+(_[a-z0-9-]+)*$
  ```

- Panjang maksimal **100 karakter**.
- Jumlah token harus sesuai pola: `utm_campaign` = 4, `utm_term` = 3, `utm_content` = 5.
- Tanpa spasi, tanpa huruf besar, tanpa emoji, tanpa karakter `{ } & ? = / . #`.
- `batch_id` = `b` + `YYMMDD` tanggal batch dimulai (Fase 2), mis. `b261125`. Jika ada lebih dari satu batch di hari yang sama, tambahkan sufiks: `b261125-2`.
- `hook` = `h` + nomor urut hook di brief (`h1`, `h2`, ...).
- Versi `v{n}` dinaikkan untuk iterasi kreatif dengan angle dan hook yang sama.

**Nilai enum:**

| Token | Nilai yang diizinkan |
|---|---|
| `objektif` | `sales`, `leads`, `traffic`, `engagement`, `awareness`, `app` |
| `funnel` | `tof`, `mof`, `bof`, `rt` |
| `format` | `img11`, `img45`, `img916`, `vid916`, `vid45`, `car` |
| `placement` | `advplus`, `feed`, `reels`, `stories`, `manual` |
| `geo` | kode negara ISO-3166 alpha-2 huruf kecil (`id`, `my`, `sg`, ...) atau `multi` |

Contoh **tidak valid**: `Ebook Ads101 - Sales` (spasi, huruf besar), `ebook_ads101_sales` (token `produk` tidak boleh mengandung `_`), `b261125_pain-time_h2_vid916_v1 - Copy` (sufiks duplikasi Meta).

### 3.5 Kunci join Meta ↔ Daekan Katalisa

- Kunci join = triple **(`utm_campaign`, `utm_term`, `utm_content`)**, dicocokkan dengan **(campaign.name, adset.name, ad.name)** di Meta.
- `utm_source` dipakai untuk breakdown placement, bukan sebagai kunci join.
- Order Daekan tanpa UTM atau dengan UTM yang melanggar regex dicatat sebagai **mismatch** di `research/latest.md`, bukan dibuang.

### 3.6 Larangan

- **DILARANG** me-rename campaign/ad set/ad yang sudah pernah live, karena histori UTM di Daekan akan terputus. Untuk perubahan, buat entitas baru atau naikkan `v{n}`.
- **DILARANG** menyimpan entitas hasil duplikasi Meta dengan sufiks `- Copy`. Rename ke pola yang valid sebelum launch.
- **DILARANG** memakai UTM berbeda di link landing page yang menimpa `url_tags`.

---

## 4. Kontrak Handoff Produksi

Plugin tidak memproduksi aset. Produksi dikerjakan plugin/agent **Video Editor** (video) dan **Designer** (static, carousel, hero/mockup LP) di luar plugin ini, berdasarkan paket `briefs/handoff/`.

### 4.1 Spesifikasi per aset (`schemas/creative-brief.schema.json`)

Satu aset = satu file `briefs/handoff/<asset_id>.json`:
- **Iklan:** `asset_id` = `ad_name` (= `utm_content`).
- **Aset LP:** `<batch_id>_lp-hero|lp-mockup[-label]_v{n}`, tanpa `ad_name`.

Isi wajib:

| Field | Isi |
|---|---|
| `schema_version`, `batch_id`, `status`, `asset_id`, `concept_id` | Identitas. Varian format satu konsep berbagi `concept_id` |
| `asset_type`, `recipient` | `video` → `video-editor`; `static`/`carousel`/`lp-hero`/`lp-mockup` → `designer` |
| `deliverables[]` | `ratio`, `size_px` (sesuai rasio), `file_type`, `duration_s` (video, ≤ 60), `max_file_mb` |
| `copy.hook_on_screen` | Teks hook yang terbaca ≤ 3 detik / teks utama di gambar |
| `copy.meta` | `primary_text` (≤ 125), `headline` (≤ 40), `description` (≤ 30), `cta` (enum Meta), opsional `variations` (≤ 5 per field) |
| `diversity` | 7 dimensi anti-similarity (§4.2) |
| `storyboard[]` + `safe_zone` | Video: `start_s`, `end_s`, `visual`, `on_screen_text`, `vo`, `music_sfx`, `transition`. Scene berurutan tanpa celah, mulai 0, ada teks di < 3 detik |
| `layout` | Static/carousel/LP: hierarki, teks on-image, tombol CTA, safe zone; carousel `cards[]` 2–10 |
| `brand` | `palette` (hex dari `lp-sync`), `fonts`, `logo_usage`, `tone` |
| `references` | `landing_page_url` (bersih), aset yang boleh dipakai (mis. dari `list_assets` Daekan), inspirasi |
| `do[]`, `dont[]`, `policy_notes[]`, `acceptance_criteria[]` | Batasan & kriteria approval aset |
| `delivery.file_name` | **`<asset_id>.<ext>`** (carousel: `<asset_id>_card<n>.<ext>`) |

Mapping format token `ad_name` → spesifikasi:

| Format | asset_type | Rasio | Ukuran |
|---|---|---|---|
| `vid916` | video | 9:16 | 1080×1920 |
| `vid45` | video | 4:5 | 1080×1350 |
| `img11` | static | 1:1 | 1080×1080 |
| `img45` | static | 4:5 | 1080×1350 |
| `img916` | static | 9:16 | 1080×1920 |
| `car` | carousel | 1:1 | 1080×1080 per kartu |

### 4.2 Seleksi konsep & Anti Meta Similarity

Sistem delivery Meta mengelompokkan kreatif yang mirip dan memperlakukannya sebagai satu kreatif yang sama, sehingga jangkauannya terpotong. Karena itu:

1. **Hanya konsep paling relevan.** Long-list kandidat angle dinilai 1–5 pada 4 dimensi: bukti data, kecocokan janji LP, kekuatan pain/desire, dan kebaruan vs iklan yang fatigue. Hanya skor tertinggi yang dibuatkan brief, default **3–5 konsep per batch**, satu angle per konsep.
2. **Diversity matrix 7 dimensi** per konsep: `angle`, `persona`, `hook_type`, `format`, `visual_world` (setting, talent, palet dominan, frame pertama), `emotional_tone`, `offer_framing`.
3. Dua konsep berbeda WAJIB:
   - berbeda di **`angle`, `hook_type`, dan `visual_world`**;
   - berbeda pada **minimal 4 dari 7** dimensi.
4. **Kemiripan teks** (Jaccard trigram kata pada `primary_text`, `headline`, `hook_on_screen`) antar konsep:
   - ≥ 0,50 → ERROR;
   - 0,35–0,50 → PERINGATAN.

   Teks juga dibandingkan dengan hook di `research/latest.md` (kompetitor & fatigue); ≥ 0,50 → PERINGATAN.
5. Varian format dari satu konsep (`vid916` + `vid45`) berbagi `concept_id` dan tidak dihitung sebagai pasangan yang mirip.
6. `creative-qa` menilai kemiripan visual & naratif yang tidak tertangkap cek mekanis (dimensi F).

### 4.3 Copy Meta siap copy-paste

- Setiap `ad_name` WAJIB punya blok `### Copy Meta — <ad_name>` di `creative-brief.md` dengan **Primary text (≤ 125 karakter), Headline (≤ 40), Description (≤ 30), CTA, dan URL** (= `landing_page_url` bersih).
- Isinya WAJIB **identik** dengan `copy.meta` di JSON. Yang di-copy-paste user ke Ads Manager sama persis dengan yang diunggah `5-launch`.
- Teks ditulis polos (tanpa markdown), lolos `hooks/policy-terms.json`, dan tanpa UTM (UTM lewat `url_tags`).

### 4.4 Siklus produksi luar

1. **Kirim.** Setelah `creative-brief.md` approved, user mengirim `handoff/video-editor.md` dan `handoff/designer.md` (+ JSON terkait) ke plugin/agent produksi pilihannya.
2. **Nama file.** Produksi mengembalikan file bernama **`<asset_id>.<ext>`**. Nama ini menjaga sinkron `ad_name` = `utm_content`.
3. **Terima.** `4-terima-aset` mencocokkan file → `asset_id`, memeriksa rasio/ukuran/durasi, lalu menjalankan QA aset.
4. **Revisi.** Aset yang `revise` mendapat catatan revisi per aset untuk dikirim balik. Ulangi sampai semua `ready`.
5. **Perubahan copy/konsep setelah brief approved** WAJIB lewat `3-creative-brief` (status kembali `draft` → QA → approve), bukan diedit langsung oleh tim produksi.

---

## 5. Aturan Keamanan

1. **Semua campaign, ad set, dan ad baru yang dibuat lewat Meta Ads MCP WAJIB berstatus `PAUSED`.** Status diset eksplisit di setiap call create.
2. **DILARANG** memanggil tool aktivasi (mis. `ads_activate_entity`) atau mengubah status ke `ACTIVE` tanpa perintah eksplisit user di percakapan untuk entitas tersebut.
3. Setelah create, WAJIB membaca ulang status entitas dan mencatatnya di `reports/launch-log.md`. Jika status bukan `PAUSED`, segera ubah ke `PAUSED` lalu laporkan ke user.
4. Perubahan budget, bid, atau penghapusan entitas yang sudah ada WAJIB dikonfirmasi user terlebih dahulu.
5. Subagent `ads-researcher`, `lp-strategist`, `creative-strategist`, dan `creative-qa` bersifat **read-only** terhadap Meta Ads MCP dan Daekan Katalisa MCP. Mereka DILARANG memanggil tool create/update/delete/publish/activate/generate.
6. **Plugin tidak men-generate aset.** Tool generate Daekan (mis. `generate_ai_images`, `generate_hero_image`, `generate_product_mockup`, `regenerate_ai_image`) dan generator gambar/video lain DILARANG dipanggil di semua fase. Tool `extract_*_brief` (read-only) BOLEH dipakai sebagai bahan brief.
7. Kredensial (token, API key, access token Meta) **DILARANG** ditulis ke repo, ke file kontrak, atau ke log. File CSV klien dan file aset/render tidak di-commit (lihat `.gitignore`).
8. Sebelum launch, Meta Pixel produk WAJIB terverifikasi aktif di Daekan dan terhubung ke ad account. Rencana launch WAJIB dikonfirmasi user sebelum tool create pertama dipanggil.
9. Pembuatan atau pengeditan landing page di Daekan **WAJIB berstatus DRAFT**. DILARANG publish otomatis. Publish hanya atas perintah eksplisit user, terpisah dari persetujuan membuat draf.
10. URL landing page di semua file `briefs/` WAJIB bersih **tanpa `utm_`**. UTM hanya lewat `url_tags` dinamis Meta (§3.2).
11. Paket handoff DILARANG ditandai `READY FOR PRODUCTION` sebelum `creative-brief.md` dan semua JSON-nya approved.

---

## 6. Quality Gate Otomatis (`hooks/`)

| Komponen | Fungsi |
|---|---|
| `hooks/hooks.json` | Hook `PostToolUse` (matcher `Write\|Edit\|MultiEdit`) yang menjalankan gate setiap kali `briefs/*.md` atau `briefs/handoff/*.json` disimpan. `briefs/archive/` dan `handoff/index.json` dikecualikan. |
| `hooks/scripts/brief-gate.mjs` | Script Node tanpa dependensi. Mode hook (stdin JSON) dan mode CLI: `node hooks/scripts/brief-gate.mjs <file>...` |
| `hooks/policy-terms.json` | Pola regex kata rawan Meta Ads Policy: `high` → error, `medium` → peringatan. |
| `schemas/creative-brief.schema.json` | JSON Schema handoff; gate menerapkan aturan yang sama tanpa dependensi. |

Yang diperiksa:
1. **Semua file `.md`:**
   - front-matter (§2.2), nilai `status`/`phase`, dan nama file ↔ phase (`lp-sync.md` → `landing-page`, `creative-brief.md` → `creative-brief`, `assets-ready.md` → `asset-intake`);
   - `source_file` sesuai §2.2;
   - `batch_id` sama dengan file hulu.
2. **UTM:** regex, jumlah token, enum, panjang, sufiks `- Copy`, dan kecocokan `batch_id`. URL berisi UTM hardcode ditolak.
3. **Kata rawan policy:** dipindai di seluruh teks, kecuali `## Hasil QA`, `## Konsep Tidak Dipilih`, baris `Negative prompt:`, blok kode, dan baris `qa-ignore`. Di JSON: field `copy`, `storyboard`, dan `layout` (tidak termasuk `dont` dan `policy_notes`).
4. **`landing-page`:**
   - `landing_page_url` wajib dan bebas `utm_`;
   - kutipan rawan di `## Audit LP Saat Ini` hanya PERINGATAN selama `draft`;
   - saat `approved`: 2–4 janji di `## Janji Utama LP` dan `meta_pixel_status: active`.
5. **`creative-brief`:**
   - setiap `ad_name` & aset LP punya JSON, dan sebaliknya;
   - setiap `ad_name` punya blok Copy Meta lengkap dengan batas karakter, identik dengan JSON;
   - diversity & kemiripan teks (§4.2);
   - semua JSON valid; saat approved, semua JSON approved dan `lp-sync` approved.
6. **`handoff/*.json`:**
   - field wajib sesuai schema;
   - `asset_id` = nama file; `ad_name` valid & sesuai format (rasio, `asset_type`, `recipient`);
   - ukuran ↔ rasio, durasi ≤ 60 detik, storyboard berurutan dengan hook < 3 detik;
   - batas karakter & CTA Meta; palette hex; URL bersih; `delivery.file_name` = `<asset_id>.<ext>`;
   - `approved` hanya bila `creative-brief.md` approved.
7. **`asset-intake`:**
   - setiap `asset_id` ada di manifest;
   - nama file diawali `asset_id`, rasio sesuai brief;
   - saat approved, semua `ready` dan brief approved.
8. `status: approved` hanya sah jika `## Hasil QA` berisi `Verdict batch: PASS`.

Perilaku: ERROR → hook keluar dengan kode 2 dan laporannya dikirim ke Claude untuk diperbaiki. PERINGATAN saja → dikirim sebagai konteks tambahan tanpa memblokir. Penulisan lewat Bash tidak memicu hook, jadi setiap skill WAJIB menjalankan gate CLI sebelum mengubah status menjadi `approved`.

---

## 7. Peta Skill & Subagent

| Perintah | Fase | Gate masuk | Subagent | Output |
|---|---|---|---|---|
| `/daekan-meta-ads:1-riset` | 1 | Kedua MCP tersedia | `ads-researcher` | `research/latest.md` |
| `/daekan-meta-ads:2-landing-page` | 2 | `research/latest.md` approved | `lp-strategist`, `creative-qa` | `briefs/lp-sync.md` (+ draf LP di Daekan bila disetujui) |
| `/daekan-meta-ads:3-creative-brief` | 3 | riset + `lp-sync.md` approved | `creative-strategist`, `creative-qa` | `briefs/creative-brief.md` + `briefs/handoff/` |
| `/daekan-meta-ads:4-terima-aset` | 4 | `creative-brief.md` approved | `creative-qa` | `briefs/assets-ready.md` |
| `/daekan-meta-ads:5-launch` | 5 | `assets-ready.md` + `lp-sync.md` approved, Pixel aktif, LP published | — | Entitas Meta PAUSED + `reports/launch-log.md` |

Skill 2, 4, dan 5 memakai `disable-model-invocation: true`: hanya berjalan jika user memanggilnya langsung, karena ketiganya membuat draf di Daekan, membaca file aset, atau membuat entitas di Meta.
