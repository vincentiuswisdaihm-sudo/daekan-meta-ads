# daekan-meta-ads

Claude Code Plugin untuk Meta Advertiser produk digital. Plugin ini menyatukan lima fase kerja dalam satu pipeline:

```
1-riset ──► 2-strategi ──► 2b-landing-page ──► 3-produksi ──► 4-launch
research/   briefs/        briefs/             briefs/         reports/
latest.md   batch-latest   lp-sync.md          assets-ready    launch-log.md
```

- **Riset:** performa & fatigue dari Meta Ads MCP, omzet per UTM dari Daekan Katalisa MCP, hook kompetitor 30 hari.
- **Strategi:** brief & offer dari landing page Daekan, lalu konsep static & video ad yang wajib lolos `creative-qa`.
- **Landing page (2B):** audit LP aktif di Daekan agar 100% *message-match* dengan hook iklan. Juga dicek kejelasan offer & order bump, serta Meta Pixel & event Purchase. Revisi dibuat sebagai **draf** di Daekan setelah Anda setuju, dan hero image 4:3 / mockup dicetak setelah konfirmasi token.
- **Produksi dual-engine:** gambar & mockup lewat AI Image Generator Daekan (estimasi token dikonfirmasi dulu, maks 4 gambar/batch). Video 9:16 & 4:5 lewat Remotion.
- **Launch:** cek Meta Pixel dan LP yang sudah published di Daekan, lalu buat campaign/ad set/ad di Meta Ads **selalu PAUSED**, dengan UTM yang sinkron ke laporan penjualan Daekan.

Semua aturan dikunci di [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prasyarat

- Claude Code ≥ 2.1.275 dan Node.js ≥ 18 (untuk quality gate & Remotion).
- **Daekan Katalisa MCP** dan **Meta Ads MCP** sudah terhubung di Claude Code. Plugin ini sengaja tidak menyertakan `.mcp.json`.
- Plugin **Remotion** terpasang.
- Opsional: skill `last30days`, `claude-ads`, `marketingskills` (`ad-creative`, `offers`, `cro`, `copywriting`), `agency-agents`, `ui-ux-pro-max`. Jika tidak ada, subagent menandai `TIDAK TERSEDIA` dan tidak mengarang data.

## Instalasi

```
/plugin install daekan-meta-ads --marketplace vincentiuswisdaihm-sudo/daekan-meta-ads
```

Untuk Claude Code versi lama:

```
/plugin marketplace add vincentiuswisdaihm-sudo/daekan-meta-ads
/plugin install daekan-meta-ads@daekan-meta-ads
```

## Pemakaian

Jalankan berurutan di folder kerja per produk/klien:

| Perintah | Hasil |
|---|---|
| `/daekan-meta-ads:1-riset <produk>` | `research/latest.md` (minta persetujuan Anda di akhir) |
| `/daekan-meta-ads:2-strategi` | `briefs/batch-latest.md` (QA PASS + persetujuan Anda) |
| `/daekan-meta-ads:2b-landing-page` | `briefs/lp-sync.md`: audit message-match, offer/order bump, Meta Pixel; draf LP & hero/mockup di Daekan (setelah konfirmasi) |
| `/daekan-meta-ads:3-produksi` | Gambar Daekan + video Remotion di `renders/`, `briefs/assets-ready.md` (palet & aset selaras LP bila `lp-sync.md` ada) |
| `/daekan-meta-ads:4-launch` | Entitas Meta Ads berstatus PAUSED ke URL LP bersih dari `lp-sync.md` + `reports/launch-log.md` |

Setiap skill **menolak berjalan** jika file fase sebelumnya belum ada atau belum `approved`:
- `2b-landing-page` dan `3-produksi` butuh `batch-latest.md`.
- `4-launch` butuh `assets-ready.md` **dan** `lp-sync.md` dengan `batch_id` yang sama.

Skill 2B, 3, dan 4 hanya berjalan jika Anda memanggilnya langsung.

## Pengaman bawaan

- **Quality gate otomatis** (`hooks/`): setiap file di `briefs/` yang disimpan (`batch-latest.md`, `lp-sync.md`, `assets-ready.md`) diperiksa:
  - phase & `batch_id` kontrak;
  - format UTM, dan URL landing page yang bebas `utm_`;
  - kata rawan Meta Ads Policy;
  - batas 4 gambar Daekan;
  - syarat `approved`: harus ada `Verdict batch: PASS`, dan untuk LP Meta Pixel harus `active`.

  Gate ini bisa juga dijalankan manual: Bisa juga dijalankan manual:

  ```bash
  node hooks/scripts/brief-gate.mjs briefs/batch-latest.md briefs/lp-sync.md
  ```

- **Selalu PAUSED:** tidak ada aktivasi iklan tanpa perintah eksplisit Anda.
- **LP selalu DRAFT:** landing page di Daekan hanya dibuat/diedit sebagai draf. Publish hanya atas perintah eksplisit Anda. `lp-strategist` read-only.
- **Penamaan UTM:** nama entitas Meta = nilai UTM. `url_tags` memakai `{{campaign.name}}`, `{{adset.name}}`, dan `{{ad.name}}`.

## Struktur

```
.claude-plugin/   plugin.json, marketplace.json
agents/           ads-researcher, creative-strategist, lp-strategist, creative-qa
skills/           1-riset, 2-strategi, 2b-landing-page, 3-produksi, 4-launch
hooks/            hooks.json, scripts/brief-gate.mjs, policy-terms.json
ARCHITECTURE.md   kontrak file, UTM, dual-engine, keamanan
```
