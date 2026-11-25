# Third-Party Notices

`daekan-meta-ads` (MIT) memakai komponen pihak ketiga berikut. Semuanya berlisensi **MIT**. Setiap komponen di-pin ke commit tertentu, sehingga perubahan upstream tidak masuk diam-diam. Pembaruan dilakukan dengan sengaja lewat rilis plugin baru.

## Dependensi plugin (terpasang otomatis, tidak disalin ke repo ini)

Didaftarkan di `.claude-plugin/marketplace.json` dan dideklarasikan di `dependencies` pada `.claude-plugin/plugin.json`. Claude Code mengunduhnya langsung dari repo aslinya.

| Nama dependensi | Upstream | Commit | Bagian yang dipasang | Hak cipta |
|---|---|---|---|---|
| `marketing-skills-core` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | `8fd2fcade2fd6629026e9dfe6d133b55b36968b9` | `skills/` → `product-marketing`, `ad-creative`, `offers`, `cro`, `copywriting` | © 2025 Corey Haines |
| `ui-ux-pro-max-core` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `8db36338810d0942567b97ce439affd1619fcf31` | `.claude/skills/` → `ui-ux-pro-max`, `design-system` | © 2024 Next Level Builder |
| `last30days` | [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | `7c2e1c2b099b13abd4397910168c4f53e638bb21` | Plugin utuh (1 skill + hook `Stop`) | © 2026 Matt Van Horn |

## Salinan referensi (dibundel di repo ini, tanpa perubahan isi)

| File | Upstream | Commit | Hak cipta |
|---|---|---|---|
| `references/agency-agents/ad-creative-strategist.md`, `references/agency-agents/image-prompt-engineer.md` | [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) | `8ae6164602c95ca78828b148b9052460ee426885` | © 2025 AgentLand Contributors |
| `references/claude-ads/meta-audit.md` | [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads) | `fc3908e786c318776df89a3a098333da377364be` | © 2026 Daniel Agrici (AgriciDaniel) |

Teks lisensi lengkap untuk salinan referensi ada di `references/*/LICENSE`. Komponen dependensi membawa lisensinya sendiri di repo masing-masing.
