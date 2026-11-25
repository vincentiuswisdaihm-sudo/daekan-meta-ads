# daekan-meta-ads

Claude Code Plugin untuk Meta Advertiser produk digital. Plugin ini menyatukan empat fase kerja dalam satu pipeline:

```
1-riset  ──►  2-strategi  ──►  3-produksi  ──►  4-launch
research/latest.md → briefs/batch-latest.md → briefs/assets-ready.md → reports/launch-log.md
```

- **Riset:** performa & fatigue dari Meta Ads MCP, omzet per UTM dari Daekan Katalisa MCP, hook kompetitor 30 hari.
- **Strategi:** brief & offer dari landing page Daekan, lalu konsep static & video ad yang wajib lolos `creative-qa`.
- **Produksi dual-engine:** gambar & mockup lewat AI Image Generator Daekan (estimasi token dikonfirmasi dulu, maks 4 gambar/batch). Video 9:16 & 4:5 lewat Remotion.
- **Launch:** cek Meta Pixel di Daekan, lalu buat campaign/ad set/ad di Meta Ads **selalu PAUSED**, dengan UTM yang sinkron ke laporan penjualan Daekan.

Semua aturan dikunci di [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prasyarat

- Claude Code ≥ 2.1.275 dan Node.js ≥ 18 (untuk quality gate & Remotion).
- **Daekan Katalisa MCP** dan **Meta Ads MCP** sudah terhubung di Claude Code. Plugin ini sengaja tidak menyertakan `.mcp.json`.
- Plugin **Remotion** terpasang.
- Opsional: skill `last30days`, `claude-ads`, `marketingskills`, `agency-agents`. Jika tidak ada, subagent menandai `TIDAK TERSEDIA` dan tidak mengarang data.

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
| `/daekan-meta-ads:3-produksi` | Gambar Daekan + video Remotion di `renders/`, `briefs/assets-ready.md` |
| `/daekan-meta-ads:4-launch` | Entitas Meta Ads berstatus PAUSED + `reports/launch-log.md` |

Setiap skill **menolak berjalan** jika file fase sebelumnya belum ada atau belum `approved`. Skill 3 dan 4 hanya berjalan jika Anda memanggilnya langsung.

## Pengaman bawaan

- **Quality gate otomatis** (`hooks/`): setiap file di `briefs/` yang disimpan diperiksa format UTM, kata rawan Meta Ads Policy, batas 4 gambar Daekan, dan syarat `approved` (harus ada `Verdict batch: PASS`). Bisa juga dijalankan manual:

  ```bash
  node hooks/scripts/brief-gate.mjs briefs/batch-latest.md
  ```

- **Selalu PAUSED:** tidak ada aktivasi iklan tanpa perintah eksplisit Anda.
- **Penamaan UTM:** nama entitas Meta = nilai UTM. `url_tags` memakai `{{campaign.name}}`, `{{adset.name}}`, dan `{{ad.name}}`.

## Struktur

```
.claude-plugin/   plugin.json, marketplace.json
agents/           ads-researcher, creative-strategist, creative-qa
skills/           1-riset, 2-strategi, 3-produksi, 4-launch
hooks/            hooks.json, scripts/brief-gate.mjs, policy-terms.json
ARCHITECTURE.md   kontrak file, UTM, dual-engine, keamanan
```
