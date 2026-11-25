# ARCHITECTURE — `daekan-meta-ads`

Dokumen ini adalah **kontrak** plugin. Semua subagent (`agents/`) dan skill (tahap berikutnya) WAJIB mematuhinya. Jika ada instruksi lain yang bertentangan dengan dokumen ini, dokumen ini yang menang, kecuali user memberi perintah eksplisit di percakapan.

Kata **WAJIB**, **DILARANG**, dan **BOLEH** dipakai dalam arti normatif.

---

## 1. Ikhtisar & Dependensi

Plugin ini menyatukan lima fase kerja Meta Advertiser produk digital:

```
Fase 1 RISET ──► Fase 2 STRATEGI ──► Fase 2B LANDING PAGE ──► Fase 3 PRODUKSI ──► Fase 4 LAUNCH
research/        briefs/             briefs/                  briefs/             reports/
latest.md        batch-latest.md     lp-sync.md               assets-ready.md     launch-log.md
```

Fase 2B dan Fase 3 sama-sama membutuhkan `briefs/batch-latest.md` yang approved. Fase 3 membaca `briefs/lp-sync.md` jika sudah ada. Fase 4 mewajibkan keduanya.

### 1.1 Dependensi eksternal (tidak dibundel di plugin ini)

| Dependensi | Jenis | Dipakai untuk |
|---|---|---|
| **Meta Ads MCP** | MCP server (sudah aktif di environment user) | Baca performa & fatigue; membuat campaign/ad set/creative/ad (selalu PAUSED) |
| **Daekan Katalisa MCP** | MCP server (sudah aktif di environment user) | Data order & laporan penjualan per UTM; produk, landing page (draf), Meta Pixel, order bump; **AI Image Generator Daekan** |
| **Remotion** | Plugin Claude Code (`remotion:*` skills) | Produksi semua video ads |
| `marketing-skills-core` (`product-marketing`, `ad-creative`, `offers`, `cro`, `copywriting`) | **Dependensi plugin (otomatis)**, subset dari `coreyhaines31/marketingskills` | Kerangka angle, offer, CRO, dan copy landing page |
| `ui-ux-pro-max-core` (`ui-ux-pro-max`, `design-system`) | **Dependensi plugin (otomatis)**, subset dari `nextlevelbuilder/ui-ux-pro-max-skill` | Struktur seksi & design system landing page |
| `last30days` | **Dependensi plugin (otomatis)**, plugin utuh dari `mvanhorn/last30days-skill` | Riset kompetitor & tren 30 hari terakhir |
| `references/claude-ads/meta-audit.md` | **Referensi dibundel**, dari `AgriciDaniel/claude-ads` | Katalog kontrol audit Meta Ads (read-only) |
| `references/agency-agents/*.md` (`Ad Creative Strategist`, `Image Prompt Engineer`) | **Referensi dibundel**, dari `msitarzewski/agency-agents` | Standar kualitas copy & prompt visual |

Semua komponen pihak ketiga berlisensi MIT dan di-pin ke commit tertentu (lihat `THIRD_PARTY_NOTICES.md`). Dependensi didaftarkan di `.claude-plugin/marketplace.json` lalu dideklarasikan di `dependencies` pada `plugin.json`, sehingga `claude plugin install daekan-meta-ads` memasang semuanya sekaligus. Yang dipasang hanya **subset skill yang dipakai pipeline**, untuk menjaga beban konteks kecil (~1.200 token always-on untuk seluruh dependensi).

**Guardrail §5 berlaku juga atas skill dependensi dan referensi.** Tidak ada skill atau referensi pihak ketiga yang boleh dipakai untuk mengubah, mempublikasikan, atau mengaktifkan entitas Meta Ads, men-generate gambar di luar Daekan, atau mempublikasikan landing page. Semua perubahan Meta Ads hanya lewat `4-launch` (PAUSED). Plugin claude-ads utuh sengaja **tidak** dipasang karena membawa skill `ads-launch`.

Plugin ini **tidak** menyertakan `.mcp.json`. Kedua MCP server sudah dikonfigurasi di environment user, dan konfigurasi duplikat akan bentrok.

### 1.2 Aturan fallback

- Nama tool MCP bisa berbeda antar environment. Subagent mencari tool berdasarkan **fungsinya** (mis. "baca entitas & insight iklan", "laporan penjualan per UTM"), bukan nama yang di-hardcode.
- Jika MCP, skill dependensi (mis. dinonaktifkan user, atau butuh API key yang belum diset), atau file referensi tidak tersedia, subagent WAJIB menulis `TIDAK TERSEDIA: <nama>` di section terkait pada file output, lalu melanjutkan dengan data yang ada. **DILARANG mengarang angka, order, atau data kompetitor.**
- Jika **Meta Ads MCP** atau **Daekan Katalisa MCP** tidak tersedia, fase yang bergantung padanya WAJIB berhenti dan melapor ke user.

---

## 2. Pipeline & Kontrak File antar-Fase

### 2.1 Peta fase

| Fase | File output | Penulis | Gate QA | Pembaca berikutnya |
|---|---|---|---|---|
| 1. Riset | `research/latest.md` | `ads-researcher` | — | `creative-strategist` |
| 2. Strategi | `briefs/batch-latest.md` | `creative-strategist` | `creative-qa` (brief) | Fase 2B, Fase Produksi |
| 2B. Landing Page | `briefs/lp-sync.md` | `lp-strategist` (audit/blueprint) + Fase 2B (eksekusi draf Daekan setelah konfirmasi user) | `creative-qa` (message-match, bebas UTM hardcode, status Meta Pixel) | Fase 3 (`3-produksi`), Fase 4 (`4-launch`) |
| 3. Produksi | `briefs/assets-ready.md` | Fase Produksi (Daekan + Remotion) | `creative-qa` (aset) | Fase Launch |
| 4. Launch | `reports/launch-log.md` | Fase Launch (Meta Ads MCP) | — | `ads-researcher` (siklus berikutnya) |

### 2.2 Front-matter wajib (semua file kontrak)

```yaml
---
batch_id: b261125            # format bYYMMDD, lihat §3.4
phase: research | strategy | landing-page | production | launch
status: draft | approved | rejected
generated_at: 2026-11-25T10:00:00+07:00   # ISO 8601
generated_by: ads-researcher              # nama subagent/skill penulis
source_file: research/latest.md           # file input fase sebelumnya (null untuk Fase 1)
---
```

### 2.3 Aturan gate

1. Fase N+1 **DILARANG** dimulai jika file output fase N tidak ada, `batch_id`-nya berbeda, atau `status != approved`. Ketergantungan per fase:

   | Fase | Wajib approved (`batch_id` sama) | Dibaca bila ada |
   |---|---|---|
   | 2 | `research/latest.md` | — |
   | 2B | `briefs/batch-latest.md` | — |
   | 3 | `briefs/batch-latest.md` | `briefs/lp-sync.md` |
   | 4 | `briefs/assets-ready.md` **dan** `briefs/lp-sync.md` | — |

2. `status: approved` pada `briefs/batch-latest.md`, `briefs/lp-sync.md`, dan `briefs/assets-ready.md` hanya boleh di-set setelah `creative-qa` memberi verdict `PASS` untuk semua item **dan** user menyetujui. Untuk `briefs/lp-sync.md` ada syarat tambahan: `meta_pixel_status` harus `active`.
3. `research/latest.md` boleh di-set `approved` oleh user setelah membaca ringkasannya.
4. **Arsip:** sebelum menimpa file `latest`/`batch-latest`/`lp-sync`/`assets-ready`, salin versi lama ke `<dir>/archive/<batch_id>.md` (mis. `briefs/archive/b261118-batch.md`, `briefs/archive/b261118-lp.md`, `briefs/archive/b261118-assets.md`, `research/archive/b261118.md`).
5. `reports/launch-log.md` bersifat **append-only**. Setiap launch menambah satu section `## <batch_id> — <tanggal>`. Entri lama DILARANG diubah.

### 2.4 Section wajib per file

**`research/latest.md`** (Fase 1)
1. `## Ringkasan Eksekutif`: 3–5 temuan utama + rekomendasi.
2. `## Performa Meta Ads`: tabel per campaign/ad set/ad: spend, impresi, CTR, CPM, CPC, CPA, ROAS (versi Meta), frequency.
3. `## Sinyal Creative Fatigue`: **Tabel Kandidat Ad Fatigue** dengan kolom `ad (utm_content) | frequency | CTR 7h vs 7h sebelumnya | CPM Δ | CPA Δ / ROAS Δ | kriteria terpenuhi | rekomendasi`. Kriteria ada di `agents/ads-researcher.md`.
4. `## Penjualan per UTM (Daekan Katalisa)`: tabel order, revenue, dan konversi per triple UTM.
5. `## Rekonsiliasi Meta ↔ Daekan`: join via triple UTM (§3.5). Wajib memuat **Tabel Performa Meta Ads vs Omzet UTM Daekan** dengan kolom `utm_campaign | utm_term | utm_content | spend | CTR | CPA Meta | ROAS Meta | order Daekan | omzet Daekan | CPA aktual | ROAS aktual | selisih ROAS` dan baris TOTAL, lalu daftar mismatch (UTM tak dikenal, entitas tanpa order, order tanpa UTM, nama yang melanggar regex).
6. `## Riset Kompetitor & Tren (30 hari)`: hasil `last30days` / Ad Library. Wajib memuat **Tabel Rangkuman Hook Kompetitor** dengan kolom `kompetitor | hook (verbatim, ≤ 15 kata) | angle | offer | format | lama tayang | sumber`.
7. `## Audit Checklist`: hasil evaluasi katalog `references/claude-ads/meta-audit.md` (✅ / ⚠️ / ❌ / `unknown` + bukti).
8. `## Peluang & Hipotesis untuk Batch Berikutnya`.

**`briefs/batch-latest.md`** (Fase 2)
1. `## Ringkasan Batch`: tujuan, produk, offer utama, anggaran indikatif. Wajib memuat sub-section `### Produk & Landing Page` yang diekstrak dari Daekan Katalisa MCP: `product_id`, `product_name`, `landing_page_url` (tanpa UTM), harga normal/promo, value stack, bonus, garansi, testimoni (verbatim), dan `meta_pixel_id`.
2. `## Struktur Kampanye`: nama campaign (`utm_campaign`) dan ad set (`utm_term`) yang diusulkan.
3. `## Konsep Kreatif`: satu sub-section `### Konsep n` per ad, berisi:
   `ad_name` (= `utm_content`), tipe (static/video), angle, offer, hook 3 detik, primary text, headline, description, CTA, format. Landing page cukup ditulis sekali di `### Produk & Landing Page`; UTM ditambahkan saat launch.
4. `## Prompt Visual Daekan`: satu heading `### Prompt n` per gambar, **maks 4 per batch** (§4.1), masing-masing dengan rasio & `ad_name`/scene tujuan.
5. `## Storyboard Remotion`: untuk konsep video, berisi scene, durasi, teks overlay, dan aset Daekan yang dipakai.
6. `## Hasil QA`: diisi dari verdict `creative-qa`.

**`briefs/lp-sync.md`** (Fase 2B)
Front-matter: `phase: landing-page`, `source_file: briefs/batch-latest.md`, dan `batch_id` sama dengan brief.
1. `## Landing Page`: `product_id`, `landing_page_url` (URL live yang akan dipakai sebagai destination; **bersih tanpa UTM**), `lp_page_id`, `lp_publish_status` (`published` | `draft`), `lp_draft_url` (jika ada draf revisi).
2. `## Audit LP Saat Ini`: snapshot LP live sebelum revisi, verbatim. Isinya headline & sub-headline above-the-fold, CTA, struktur seksi, offer, dan klaim berisiko.
3. `## Message-Match`: baris `message_match_score: <0–100>` + tabel `ad_name | janji/hook iklan | above-the-fold LP | skor (1–5) | gap | aksi`, satu baris per `ad_name` di brief. Target: 100%.
4. `## Offer & Order Bump`: harga normal/promo, value stack, bonus, garansi, dan `order_bump` (produk, harga, posisi di checkout). Harus konsisten dengan `### Produk & Landing Page` di brief.
5. `## Blueprint & Revisi LP`: struktur seksi (hero → problem → solusi → offer stack → bukti → garansi → FAQ → CTA), copy above-the-fold yang selaras dengan hook iklan, dan daftar revisi beserta prioritasnya.
6. `## Visual & Palet`: token warna (hex), font, gaya visual, dan tabel `prompt | daekan_asset_url | rasio | dipakai_oleh` untuk hero image (4:3) / product mockup dari Daekan (maks 4, §4.1).
7. `## Pixel & Tracking`: `meta_pixel_id`, `meta_pixel_status` (`active` | `inactive` | `unknown`), `purchase_event` (event & halaman/trigger, mis. Purchase di halaman sukses bayar), `initiate_checkout`, dan kecocokan dengan dataset di ad account Meta.
8. `## Eksekusi Daekan`: log tindakan di Daekan (draf dibuat/diedit, selalu DRAFT; publish hanya atas perintah eksplisit user), konfirmasi user, serta estimasi vs konsumsi token.
9. `## Hasil QA`: diisi dari verdict `creative-qa` (mode landing page).

**`briefs/assets-ready.md`** (Fase 3)
1. `## Aset Daekan`: tabel `prompt | daekan_asset_url | rasio | dipakai_oleh`, satu baris per gambar hasil AI Image Generator Daekan (maks 4). URL = URL Asset Library Daekan. Aset dari `lp-sync.md` yang dipakai ulang ditulis dengan `prompt` berawalan `lp-` (mis. `lp-hero`) dan tidak dihitung dalam batas 4 (§4.1).
2. `## Manifest Aset`: tabel `ad_name | format | engine | daekan_asset_url | render_path | durasi | rasio | status`, satu baris per ad. `engine` ∈ `daekan` (static) | `remotion` (video). Untuk video, `daekan_asset_url` berisi URL Daekan yang dipakai di dalam video. `status` ∈ `pending` | `ready` | `failed`.
3. `## Estimasi & Konsumsi Token Daekan`: estimasi yang dikonfirmasi user vs aktual.
4. `## Catatan Render Remotion`: composition id, resolusi, fps, durasi, path props.
5. `## Hasil QA`: diisi dari verdict `creative-qa`.

**`reports/launch-log.md`** (Fase 4, append-only)
Front-matter dibuat saat file pertama kali ditulis. Satu-satunya perubahan yang diizinkan setelahnya adalah memperbarui `batch_id` dan `generated_at` ke batch terbaru. Isi di bawah front-matter hanya boleh ditambah.
Per batch, satu section `## <batch_id> — <tanggal>` berisi:
1. Tabel `level | nama (= nilai UTM) | meta_id | status | created_at`. Kolom status WAJIB `PAUSED`.
2. URL tujuan final lengkap dengan `url_tags` (§3.2).
3. Verifikasi pasca-create: hasil baca ulang status dari Meta Ads MCP.
4. Catatan: siapa yang boleh mengaktifkan, dan kapan.

### 2.5 Format machine-readable (dibaca quality gate §6)

Agar bisa diperiksa otomatis, nilai UTM di file `briefs/` WAJIB ditulis dalam salah satu bentuk berikut:

- **Deklarasi key-value** di awal baris, nilainya di dalam backtick:
  ```markdown
  - utm_campaign: `ebook-ads101_sales_tof_20261125`
  - utm_term: `lal1-buyers_id_advplus`
  - ad_name: `b261125_pain-time_h2_vid916_v1`
  ```
- **Kolom tabel** dengan header persis `ad_name`, `utm_content`, `utm_campaign`, atau `utm_term`.

Pola contoh yang memakai `{...}` atau `<...>` tidak divalidasi. Nilai `PENDING`, `-`, dan `n/a` dianggap placeholder.

Di `briefs/lp-sync.md`, key berikut WAJIB ditulis sebagai deklarasi key-value:

```markdown
- landing_page_url: `https://toko.daekan.id/ebook-ads101`
- lp_publish_status: `published`
- message_match_score: `95`
- meta_pixel_id: `123456789012345`
- meta_pixel_status: `active`
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
- `batch_id` = `b` + `YYMMDD` tanggal brief dibuat, mis. `b261125`. Jika ada lebih dari satu batch di hari yang sama, tambahkan sufiks: `b261125-2`.
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

## 4. Aturan Produksi Dual-Engine

| Jenis aset | Engine WAJIB | Engine DILARANG |
|---|---|---|
| Gambar iklan (single image, carousel card), hero image, product mockup | **AI Image Generator Daekan** (via Daekan Katalisa MCP) | Generator gambar lain (Higgsfield, ElevenLabs, Figma, Canva AI, DALL·E, dll.) |
| Video ads 9:16 (Reels/Stories) dan 4:5 (Feed) | **Remotion** | Generator video AI lain, editor manual di luar pipeline |

### 4.1 Gambar: AI Image Generator Daekan

1. Sumber prompt:
   - Gambar iklan: `## Prompt Visual Daekan` di `briefs/batch-latest.md` yang `status: approved`.
   - Hero image (4:3) & product mockup landing page: `## Blueprint & Revisi LP` / `## Visual & Palet` di `briefs/lp-sync.md` (Fase 2B).
2. **Sebelum generate**, WAJIB menampilkan ke user: jumlah gambar, rasio tiap gambar, dan **estimasi token Daekan**, lalu menunggu **konfirmasi eksplisit** ("ya"/"lanjut"). Tanpa konfirmasi, DILARANG generate. Aturan ini juga berlaku untuk hero image & mockup LP.
3. **Maksimal 4 gambar per batch**, dihitung per fase: maksimal 4 di Fase 2B dan maksimal 4 di Fase 3. Kebutuhan lebih dari 4 dipecah ke batch konfirmasi berikutnya.
4. Setiap hasil dicatat dengan `daekan_asset_url` dan tujuan pemakaiannya: aset iklan di `briefs/assets-ready.md`, aset LP di `briefs/lp-sync.md`.
5. Regenerate dihitung sebagai generate baru, jadi wajib konfirmasi lagi dan tetap tunduk pada batas 4 gambar.
6. Fase 3 BOLEH memakai ulang hero/mockup dari `briefs/lp-sync.md` tanpa generate ulang. Baris aset tersebut ditulis dengan `prompt` berawalan `lp-` dan tidak dihitung dalam batas 4 Fase 3.

### 4.2 Video: Remotion

1. Semua video ads WAJIB dibuat sebagai composition Remotion:
   - **9:16** Reels/Stories: 1080×1920
   - **4:5** Feed: 1080×1350
   - 30 fps, durasi mengikuti storyboard (disarankan 6–30 detik).
2. Seluruh visual di video WAJIB memakai **URL aset dari Daekan** yang tercatat di `briefs/assets-ready.md`. Aset visual dari sumber lain tidak boleh dipakai.
3. Hook harus terbaca jelas di **3 detik pertama**. Teks overlay berada di dalam safe zone (hindari ±14% atas dan ±20% bawah pada 9:16).
4. Output render disimpan lokal di `out/` atau `renders/` (di-gitignore). Path render dicatat di `briefs/assets-ready.md`.

---

## 5. Aturan Keamanan

1. **Semua campaign, ad set, dan ad baru yang dibuat lewat Meta Ads MCP WAJIB berstatus `PAUSED`.** Status diset eksplisit di setiap call create, tidak bergantung pada default.
2. **DILARANG** memanggil tool aktivasi (mis. `ads_activate_entity`) atau mengubah status ke `ACTIVE` tanpa perintah eksplisit user di percakapan untuk entitas tersebut.
3. Setelah create, WAJIB membaca ulang status entitas dari Meta Ads MCP dan mencatatnya di `reports/launch-log.md`. Jika status bukan `PAUSED`, segera ubah ke `PAUSED` lalu laporkan ke user.
4. Perubahan budget, bid, atau penghapusan entitas yang sudah ada WAJIB dikonfirmasi user terlebih dahulu.
5. Subagent `ads-researcher` dan `creative-qa` bersifat **read-only** terhadap Meta Ads MCP dan Daekan Katalisa MCP. Mereka DILARANG memanggil tool create/update/delete/activate/generate.
6. Kredensial (token, API key, access token Meta) **DILARANG** ditulis ke repo, ke file kontrak, atau ke log. File CSV klien dan render video tidak di-commit (lihat `.gitignore`).
7. Sebelum launch, Meta Pixel produk WAJIB terverifikasi aktif di Daekan dan terhubung ke ad account. Rencana launch (nama, budget, targeting, aset, `url_tags`) WAJIB dikonfirmasi user sebelum tool create pertama dipanggil.
8. Subagent `lp-strategist` bersifat **read-only** terhadap Daekan Katalisa MCP dan Meta Ads MCP. Ia DILARANG memanggil tool create/update/delete/publish/activate/generate.
9. Pembuatan atau pengeditan landing page di Daekan Katalisa MCP **WAJIB berstatus DRAFT**. DILARANG publish otomatis. Publish hanya boleh atas perintah eksplisit user di percakapan, terpisah dari persetujuan membuat draf.
10. Cetak hero image (4:3) atau product mockup di Daekan WAJIB menampilkan estimasi token dan menunggu konfirmasi user (§4.1).
11. URL landing page yang dicatat di `briefs/lp-sync.md` WAJIB berupa URL bersih **tanpa parameter UTM hardcode**. String `utm_` tidak boleh muncul sama sekali. UTM tetap dipasang lewat `url_tags` dinamis Meta (§3.2).

---

## 6. Quality Gate Otomatis (`hooks/`)

| Komponen | Fungsi |
|---|---|
| `hooks/hooks.json` | Hook `PostToolUse` (matcher `Write\|Edit\|MultiEdit`) yang menjalankan gate setiap kali file `briefs/*.md` disimpan. Folder `briefs/archive/` dikecualikan. |
| `hooks/scripts/brief-gate.mjs` | Script Node tanpa dependensi. Mode hook (stdin JSON) dan mode CLI: `node hooks/scripts/brief-gate.mjs <file>...` |
| `hooks/policy-terms.json` | Daftar pola regex kata rawan Meta Ads Policy: `high` → error, `medium` → peringatan. Boleh disesuaikan per niche. |

Yang diperiksa:
1. Front-matter wajib (§2.2), nilai `status`, dan nilai `phase`. Nama file harus cocok dengan phase-nya: `batch-latest.md` → `strategy`, `lp-sync.md` → `landing-page`, `assets-ready.md` → `production`.
2. `batch_id` di `lp-sync.md` dan `assets-ready.md` harus sama dengan `briefs/batch-latest.md` di folder yang sama.
3. Semua nilai UTM (§2.5) terhadap regex, jumlah token, enum, panjang, sufiks `- Copy`, dan kecocokan `batch_id`.
4. URL berisi UTM hardcode (§3.2).
5. Kata rawan policy di seluruh file, kecuali section `## Hasil QA`, baris `Negative prompt:`, blok kode, dan baris yang memuat `qa-ignore`.
6. Batas 4 gambar Daekan (§4.1), engine yang diizinkan, dan kelengkapan URL/path saat `approved` (§4). Baris `lp-…` di Fase 3 tidak dihitung dalam batas.
7. **Khusus `phase: landing-page`:**
   - `source_file` harus `briefs/batch-latest.md`.
   - `landing_page_url` wajib ada, berupa http(s), dan **tidak mengandung `utm_`**.
   - Frasa rawan di `## Audit LP Saat Ini` hanya menjadi PERINGATAN selama `draft` (kutipan LP lama), dan menjadi ERROR saat `approved`.
   - Saat `approved`: `meta_pixel_status` wajib `active`.
8. `status: approved` hanya sah jika `## Hasil QA` berisi `Verdict batch: PASS` (§2.3), untuk `strategy`, `landing-page`, dan `production`.

Perilaku: ERROR → hook keluar dengan kode 2 dan laporannya dikirim ke Claude untuk diperbaiki. PERINGATAN saja → dikirim sebagai konteks tambahan tanpa memblokir.

Penulisan lewat Bash tidak memicu hook. Karena itu setiap skill WAJIB juga menjalankan gate CLI sebelum mengubah status menjadi `approved`.

---

## 7. Peta Skill & Subagent

| Perintah | Fase | Gate masuk | Subagent | Output |
|---|---|---|---|---|
| `/daekan-meta-ads:1-riset` | 1 | Kedua MCP tersedia | `ads-researcher` | `research/latest.md` |
| `/daekan-meta-ads:2-strategi` | 2 | `research/latest.md` ada & approved | `creative-strategist`, `creative-qa` | `briefs/batch-latest.md` |
| `/daekan-meta-ads:2b-landing-page` | 2B | `briefs/batch-latest.md` approved + gate lolos | `lp-strategist`, `creative-qa` | `briefs/lp-sync.md` (+ draf LP & hero/mockup di Daekan) |
| `/daekan-meta-ads:3-produksi` | 3 | `briefs/batch-latest.md` approved + gate lolos (membaca `lp-sync.md` bila ada) | `creative-qa` | `briefs/assets-ready.md` + `renders/` |
| `/daekan-meta-ads:4-launch` | 4 | `briefs/assets-ready.md` & `briefs/lp-sync.md` approved (`batch_id` sama) + gate lolos + pixel aktif + LP published | — | Entitas Meta PAUSED + `reports/launch-log.md` |

Skill 2B, 3, dan 4 memakai `disable-model-invocation: true`: hanya berjalan jika user memanggilnya langsung, karena ketiganya memakai token Daekan, membuat draf di Daekan, atau membuat entitas di Meta.
