# daekan-meta-ads

Claude Code Plugin untuk Meta Advertiser produk digital. Plugin ini **tidak memproduksi aset**. Tugasnya menyusun **Creative Brief** yang lengkap dan approved untuk dikerjakan plugin/agent **Video Editor** dan **Designer** lain, lalu menerima kembali asetnya dan me-launch di Meta Ads dalam status PAUSED.

```
1-riset ──► 2-landing-page ──► 3-creative-brief ══► [ produksi di luar plugin ] ══► 4-terima-aset ──► 5-launch
research/   briefs/            briefs/creative-brief.md    Video Editor / Designer      briefs/            reports/
latest.md   lp-sync.md         briefs/handoff/*.json                                    assets-ready.md    launch-log.md
```

- **Riset:**
  - performa & fatigue dari Meta Ads MCP;
  - omzet per UTM dari Daekan Katalisa MCP;
  - hook kompetitor 30 hari;
  - audit akun.
- **Landing page:**
  - LP aktif di Daekan diaudit, lalu ditetapkan **2–4 Janji Utama** yang akan diikuti semua iklan;
  - offer, order bump, dan Meta Pixel dicek;
  - revisi dibuat sebagai **draf** di Daekan setelah Anda setuju;
  - hero image/mockup tidak dicetak, tetapi masuk brief untuk Designer.
- **Creative Brief:**
  - hanya **3–5 konsep paling relevan** (skor berbasis data);
  - dijamin **berbeda satu sama lain** (anti Meta similarity);
  - setiap iklan punya **Copy Meta siap copy-paste**: Primary text, Headline, Description, CTA, URL;
  - paket produksi per aset: JSON + paket untuk Video Editor & Designer.
- **Terima Aset:** file hasil produksi dicocokkan dengan brief (nama, rasio, ukuran, durasi), lalu QA visual dan catatan revisi per aset.
- **Launch:** campaign, ad set, dan ad dibuat di Meta Ads **selalu PAUSED**, dengan UTM sinkron ke laporan penjualan Daekan.

Semua aturan dikunci di [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prasyarat

- Claude Code ≥ 2.1.275 dan Node.js ≥ 18 (untuk quality gate).
- **Daekan Katalisa MCP** dan **Meta Ads MCP** sudah terhubung di Claude Code. Plugin ini sengaja tidak menyertakan `.mcp.json`.
- Plugin/agent produksi pilihan Anda untuk video dan desain (di luar plugin ini).
- Skill pendukung **terpasang otomatis** sebagai dependensi:
  - `marketing-skills-core`: `product-marketing`, `ad-creative`, `offers`, `cro`, `copywriting`;
  - `ui-ux-pro-max-core`: `ui-ux-pro-max`, `design-system`;
  - `last30days`.

  Katalog audit Meta dari claude-ads dan standar agency-agents dibundel di `references/`. Seluruh dependensi menambah sekitar 1.200 token konteks. Rinciannya di [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- `last30days` bisa memakai API key opsional untuk sebagian sumbernya. Tanpa key, sumber itu ditandai `TIDAK TERSEDIA` dan tidak ada data yang dikarang.

## Instalasi

```
/plugin install daekan-meta-ads --marketplace vincentiuswisdaihm-sudo/daekan-meta-ads
```

Perintah ini juga memasang dependensinya. Jika sebelumnya Anda sudah memasang `marketing-skills`, `ui-ux-pro-max`, atau `last30days` dari marketplace aslinya, skill yang sama bisa muncul dua kali; copot salah satunya.

Untuk Claude Code versi lama:

```
/plugin marketplace add vincentiuswisdaihm-sudo/daekan-meta-ads
/plugin install daekan-meta-ads@daekan-meta-ads
```

## Pemakaian

Jalankan berurutan di satu folder kerja per produk/klien:

| Perintah | Hasil | Yang Anda lakukan |
|---|---|---|
| `/daekan-meta-ads:1-riset <produk>` | `research/latest.md` | Setujui ringkasan riset |
| `/daekan-meta-ads:2-landing-page` | `briefs/lp-sync.md` | Setujui Janji Utama LP; pilih apakah revisi dibuat sebagai draf di Daekan |
| `/daekan-meta-ads:3-creative-brief [jumlah konsep]` | `briefs/creative-brief.md` + `briefs/handoff/` | Setujui **seluruh** brief, lalu copy-paste Copy Meta bila perlu |
| *(di luar plugin)* | File aset `<asset_id>.<ext>` | Kirim `handoff/video-editor.md` & `handoff/designer.md` ke plugin produksi |
| `/daekan-meta-ads:4-terima-aset <folder/URL>` | `briefs/assets-ready.md` | Kirim catatan revisi bila ada, lalu setujui aset |
| `/daekan-meta-ads:5-launch` | Entitas Meta PAUSED + `reports/launch-log.md` | Isi budget & targeting, setujui rencana launch |

Setiap langkah **menolak berjalan** jika file langkah sebelumnya belum ada atau belum `approved`. Skill 2, 4, dan 5 hanya berjalan jika Anda memanggilnya langsung.

### Mengirim brief ke Video Editor / Designer

Setelah brief approved, paket di `briefs/handoff/` berlabel **`READY FOR PRODUCTION — batch <id>`**:

| File | Untuk |
|---|---|
| `video-editor.md` | Semua video (9:16 / 4:5): storyboard per scene, teks on-screen, VO/musik, safe zone, durasi |
| `designer.md` | Static, carousel, hero/mockup LP: layout, teks on-image, CTA, palet, ukuran |
| `<asset_id>.json` | Spesifikasi lengkap per aset, sesuai [`schemas/creative-brief.schema.json`](schemas/creative-brief.schema.json). Contoh ada di [`schemas/examples/`](schemas/examples/) |

Tempel paket `.md`-nya (dan lampirkan JSON-nya) ke plugin produksi pilihan Anda. Satu aturan wajib: **file hasil produksi harus bernama `<asset_id>.<ext>`** (mis. `b261126_time-pain_h1_vid916_v1.mp4`), supaya nama iklan tetap sama dengan `utm_content`.

### Copy Meta siap copy-paste

Setiap iklan di `briefs/creative-brief.md` punya blok seperti ini, siap ditempel ke Meta Ads Manager:

```text
### Copy Meta — b261126_time-pain_h1_vid916_v1
Primary text: Masih 3 jam riset iklan tiap minggu? Template ini memangkasnya jadi 30 menit.
Headline: Riset Iklan Selesai 30 Menit
Description: Ebook + 50 template
CTA: LEARN_MORE
URL: https://toko.daekan.id/ebook-ads101
```

Batasnya: Primary text ≤ 125 karakter, Headline ≤ 40, dan Description ≤ 30. Isinya identik dengan yang diunggah `5-launch`.

## Pengaman bawaan

- **Quality gate otomatis** (`hooks/`): setiap `briefs/*.md` dan `briefs/handoff/*.json` yang disimpan diperiksa:
  - kontrak & `batch_id`;
  - format UTM, dan URL bebas `utm_`;
  - Copy Meta (wajib, batas karakter, identik dengan JSON);
  - **anti Meta similarity** (diversity matrix & kemiripan teks antar konsep);
  - kelengkapan spesifikasi produksi;
  - kata rawan Meta Ads Policy;
  - Meta Pixel aktif;
  - `approved` hanya dengan `Verdict batch: PASS`.

  Gate ini bisa juga dijalankan manual:

  ```bash
  node hooks/scripts/brief-gate.mjs briefs/creative-brief.md briefs/lp-sync.md
  ```

- **Tidak ada produksi di plugin:** tidak ada gambar atau video yang di-generate.
- **Selalu PAUSED:** tidak ada aktivasi iklan tanpa perintah eksplisit Anda.
- **LP selalu DRAFT:** landing page di Daekan hanya dibuat/diedit sebagai draf. Publish hanya atas perintah eksplisit Anda.
- **Penamaan UTM:** nama entitas Meta = nilai UTM. `url_tags` memakai `{{campaign.name}}`, `{{adset.name}}`, dan `{{ad.name}}`.

## Perubahan dari v0.4

Ini perubahan yang tidak kompatibel dengan versi lama (breaking change):

| v0.4 | v0.5 |
|---|---|
| `2-strategi` (`batch-latest.md`) | Dilebur ke `3-creative-brief` (`creative-brief.md` + `handoff/`) |
| `2b-landing-page` (setelah strategi) | `2-landing-page`, sekarang sebelum brief |
| `3-produksi` (Daekan + Remotion) | Dihapus. Produksi di luar plugin, diterima lewat `4-terima-aset` |
| `4-launch` | `5-launch` |

File lama seperti `briefs/batch-latest.md` tidak dimigrasi otomatis; pindahkan ke `briefs/archive/` sebelum memulai batch baru.

## Struktur

```
.claude-plugin/   plugin.json, marketplace.json, icon.png (+ sumber icon.svg)
agents/           ads-researcher, lp-strategist, creative-strategist, creative-qa
skills/           1-riset, 2-landing-page, 3-creative-brief, 4-terima-aset, 5-launch
hooks/            hooks.json, scripts/brief-gate.mjs, policy-terms.json
schemas/          creative-brief.schema.json (+ examples/)
references/       salinan referensi pihak ketiga (agency-agents, claude-ads meta-audit)
ARCHITECTURE.md   kontrak file, UTM, handoff produksi, keamanan
THIRD_PARTY_NOTICES.md  atribusi & commit ter-pin semua komponen pihak ketiga
```

## Lisensi

[MIT](LICENSE) © 2026 vincentiuswisdaihm-sudo
