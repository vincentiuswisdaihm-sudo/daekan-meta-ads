# Referensi claude-ads (dibundel)

`meta-audit.md` adalah salinan **tanpa perubahan** dari [AgriciDaniel/claude-ads](https://github.com/AgriciDaniel/claude-ads) (`ads/references/meta-audit.md`) pada commit `fc3908e786c318776df89a3a098333da377364be`, berlisensi MIT (lihat `LICENSE` di folder ini).

Plugin claude-ads utuh **sengaja tidak dijadikan dependensi**, karena dua alasan:
- Isinya 34 skill dan 25 agent, sekitar 6.600 token yang selalu dimuat di setiap sesi.
- Ia membawa skill `ads-launch` yang bisa mempublikasikan atau mengaktifkan campaign, dan itu bertentangan dengan guardrail PAUSED di `ARCHITECTURE.md` §5.

File ini dibaca oleh `agents/ads-researcher.md` sebagai katalog kontrol audit Meta Ads, dan hanya untuk dibaca. Aturan di dalamnya yang merujuk alur kerja claude-ads (conductor, schema JSON, adapter) tidak berlaku di plugin ini.

Untuk memperbarui, salin ulang dari commit baru, perbarui SHA di sini dan di `THIRD_PARTY_NOTICES.md`, lalu naikkan versi plugin.
