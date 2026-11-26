---
name: 3-creative-brief
description: Fase 3 pipeline daekan-meta-ads. Hanya berjalan jika research/latest.md dan briefs/lp-sync.md approved. Subagent creative-strategist memilih HANYA 3–5 konsep/angle paling relevan (skor relevansi berbasis data), memastikan anti Meta similarity antar konsep, lalu menulis briefs/creative-brief.md dengan Copy Meta siap copy-paste (Primary text, Headline, Description, CTA, URL) dan paket produksi briefs/handoff/ (JSON per aset + video-editor.md + designer.md) untuk plugin Video Editor/Designer lain. Wajib lolos creative-qa dan persetujuan user sebelum paket ditandai READY FOR PRODUCTION. Gunakan saat user minta menyusun angle, hook, copy iklan, atau creative brief.
argument-hint: "[jumlah konsep, mis. 4] [catatan, mis. fokus angle / format]"
---

# 3 · Creative Brief — Siap Copy-Paste & Siap Produksi

Output fase ini:
1. **`briefs/creative-brief.md`**: master brief.
   - Konsep terpilih, diversity matrix, dan struktur kampanye/UTM.
   - **Copy Meta per `ad_name`** (Primary text, Headline, Description, CTA, URL) yang bisa langsung di-copy-paste ke Meta Ads Manager.
2. **`briefs/handoff/`**: paket untuk produksi di luar plugin.
   - `<asset_id>.json` per aset;
   - `video-editor.md`, `designer.md`, dan `index.json`.

Plugin **tidak memproduksi aset**. Produksi oleh plugin/agent Video Editor & Designer lain baru boleh dimulai **setelah seluruh brief approved**.

**Kontrak yang mengikat:** `ARCHITECTURE.md` §2.4–§2.5, §3 (UTM), §4 (handoff, seleksi & anti-similarity, Copy Meta), §5, §6, serta `schemas/creative-brief.schema.json`.

Argumen dari user: `$ARGUMENTS` (default 3–5 konsep).

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs briefs/creative-brief.md` (sekaligus memeriksa semua `briefs/handoff/*.json`). `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`.

---

## Langkah 0 — GATE (wajib, jalankan paling awal)

1. **TOLAK** jika salah satu kondisi berikut terpenuhi:
   - `research/latest.md` tidak ada atau belum `approved`;
   - `briefs/lp-sync.md` tidak ada atau belum `approved`;
   - gate CLI pada `briefs/lp-sync.md` mengeluarkan ERROR.

   Pesan penolakan:
   > Fase 3 tidak bisa dijalankan: `<file>` belum APPROVED. Selesaikan `/daekan-meta-ads:1-riset` dan `/daekan-meta-ads:2-landing-page` terlebih dahulu.
2. `batch_id` = `batch_id` di `lp-sync.md`.
3. Jika `briefs/creative-brief.md` atau `briefs/handoff/` sudah ada dari batch lain, arsipkan ke `briefs/archive/<batch_id-lama>-brief.md` dan `briefs/archive/<batch_id-lama>-handoff/`. Jika batch-nya sama, lanjutkan (resume).

## Langkah 1 — Susun brief oleh `creative-strategist`

Panggil tool **Agent** dengan `subagent_type: "daekan-meta-ads:creative-strategist"` (fallback: `"creative-strategist"`):

```
Jalankan Fase 3 Creative Brief sesuai ARCHITECTURE.md §4 dan instruksi agent-mu.
- batch_id: <bYYMMDD> | input: research/latest.md + briefs/lp-sync.md (approved)
- Jumlah konsep: <dari argumen, default 3–5> | catatan user: <$ARGUMENTS atau "-">
Wajib:
1. Long-list 6–10 angle → skor relevansi 4 dimensi → pilih HANYA yang skornya tertinggi; sisanya ke "## Konsep Tidak Dipilih".
2. Diversity Matrix 7 dimensi; antar konsep beda di angle, hook_type, visual_world (frame pertama) dan ≥ 4/7 dimensi;
   copy tidak boleh mirip antar konsep maupun dengan hook kompetitor/fatigue di riset.
3. Setiap iklan meneruskan salah satu "## Janji Utama LP".
4. Blok "### Copy Meta — <ad_name>" untuk SETIAP ad_name (Primary text ≤125, Headline ≤40, Description ≤30, CTA, URL bersih),
   identik dengan copy.meta di JSON.
5. briefs/handoff/<asset_id>.json per aset (termasuk aset LP dari "## Kebutuhan Visual LP"), status "draft",
   sesuai schemas/creative-brief.schema.json; plus video-editor.md, designer.md (header DRAFT), index.json.
```

## Langkah 2 — Quality gate mekanis

Jalankan gate CLI pada `briefs/creative-brief.md`. Gate memeriksa:
- pasangan brief ↔ JSON;
- Copy Meta (wajib, batas karakter, identik dengan JSON);
- diversity & kemiripan teks;
- UTM, URL bersih, policy, dan spesifikasi produksi.

Tindak lanjut:
- **ERROR** → kirim ke `creative-strategist` untuk diperbaiki, lalu ulangi sampai lolos.
- **PERINGATAN** (mis. kemiripan 0,35–0,50 atau mirip hook kompetitor) → teruskan ke `creative-qa`.

## Langkah 3 — Audit `creative-qa` (wajib lolos)

Panggil **Agent** `daekan-meta-ads:creative-qa` (fallback: `creative-qa`):
```
Mode brief. Review briefs/creative-brief.md dan semua briefs/handoff/*.json terhadap research/latest.md,
briefs/lp-sync.md, schemas/creative-brief.schema.json, dan hooks/policy-terms.json.
Peringatan quality gate yang wajib kamu cek: <tempel PERINGATAN, atau "tidak ada">
```
Tempel hasilnya ke `## Hasil QA`.

- **REVISE / FAIL:** kirim seluruh Temuan ke `creative-strategist`, lalu ulangi Langkah 2 → 3. Maksimal 3 putaran; setelah itu `status: rejected` dan minta arahan user.

## Langkah 4 — Persetujuan user

Tampilkan ke user:
1. **Konsep terpilih:** tabel `concept_id | angle | skor | hook_type | visual_world | format`, plus konsep yang gugur beserta alasannya.
2. **Copy Meta per `ad_name`:** tampilkan apa adanya, siap copy-paste.
3. **Ringkasan produksi:** jumlah aset per penerima (Video Editor / Designer), rasio, dan durasi.
4. Verdict QA.

Tanyakan: **"Setujui SELURUH brief batch `<batch_id>` untuk diproduksi?"**

- **Ya:**
  1. Set `status: approved` di `creative-brief.md` dan **di semua** `handoff/*.json` (serta `index.json`).
  2. Ganti header `video-editor.md` dan `designer.md` menjadi **`READY FOR PRODUCTION — batch <batch_id>`**.
  3. Jalankan gate CLI sekali lagi; harus lolos tanpa ERROR.
- **Revisi:** kembali ke Langkah 1 dengan catatan user. Status tetap `draft`, dan paket tidak boleh dikirim ke produksi.

## Langkah 5 — Serahkan ke produksi

Beri tahu user cara memakai paketnya:
- **Video:** kirim `briefs/handoff/video-editor.md` (+ JSON yang dirujuk) ke plugin/agent Video Editor pilihan Anda.
- **Static, carousel, dan visual LP:** kirim `briefs/handoff/designer.md` (+ JSON) ke plugin/agent Designer.
- Hasil produksi wajib bernama **`<asset_id>.<ext>`**, lalu dikembalikan lewat **`/daekan-meta-ads:4-terima-aset`**.
- Perubahan konsep/copy setelah approved harus lewat skill ini lagi, jangan diedit oleh tim produksi.

## Larangan
- DILARANG men-generate gambar/video atau memanggil tool generate apa pun.
- DILARANG membuat brief untuk konsep yang tidak lolos seleksi relevansi, atau untuk konsep yang mirip satu sama lain.
- DILARANG menandai `READY FOR PRODUCTION` sebelum QA PASS + persetujuan user, atau saat ada JSON yang belum approved.
- DILARANG memakai URL dengan `utm_` atau mengubah offer dari `lp-sync.md`.

## Selesai
Laporkan:
- jumlah konsep & aset;
- path `briefs/creative-brief.md` & `briefs/handoff/`;
- status (DRAFT / READY FOR PRODUCTION).

Langkah berikutnya, setelah aset jadi: **`/daekan-meta-ads:4-terima-aset`**.
