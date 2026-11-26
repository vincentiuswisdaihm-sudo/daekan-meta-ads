---
name: 4-terima-aset
description: Fase 4 pipeline daekan-meta-ads. Hanya berjalan jika briefs/creative-brief.md approved. Menerima aset hasil produksi luar (plugin/agent Video Editor & Designer) dari folder lokal, Google Drive, atau URL, mencocokkan nama file dengan asset_id, memeriksa rasio/ukuran/durasi terhadap briefs/handoff/*.json, menjalankan creative-qa mode aset, membuat catatan revisi per aset bila perlu, lalu menulis briefs/assets-ready.md berstatus approved untuk launch.
argument-hint: "<folder/URL lokasi aset>"
disable-model-invocation: true
---

# 4 · Terima Aset — QA Hasil Produksi Luar

Output: **`briefs/assets-ready.md`** (`phase: asset-intake`, `source_file: briefs/creative-brief.md`). Isinya:
- `## Manifest Aset`: `asset_id | recipient | file | ratio | size | duration | status`;
- `## Catatan Revisi`;
- `## Hasil QA`.

**Kontrak yang mengikat:** `ARCHITECTURE.md` §2.4, §4.1, §4.4, §5, §6.

Lokasi aset dari user: `$ARGUMENTS`

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs briefs/assets-ready.md`. `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`.

---

## Langkah 0 — GATE

1. Jika `briefs/creative-brief.md` tidak ada atau belum `approved`, atau ada `briefs/handoff/*.json` yang belum `approved`, **TOLAK**:
   > Fase 4 tidak bisa dijalankan: Creative Brief batch ini belum APPROVED. Selesaikan `/daekan-meta-ads:3-creative-brief` terlebih dahulu.
2. Daftar aset yang diharapkan = semua `briefs/handoff/*.json` (kecuali `index.json`).
3. Jika `assets-ready.md` sudah ada untuk batch yang sama, lanjutkan (resume). Aset yang sudah `ready` tidak perlu diperiksa ulang kecuali file-nya berubah.

## Langkah 1 — Kumpulkan file
- **Sumber:**
  - folder lokal (mis. `assets/`; di-gitignore bila berisi render besar);
  - folder/URL Google Drive;
  - URL Asset Library Daekan (`list_assets`).

  Jika lokasi belum diberikan, tanyakan sekali.
- Cocokkan file → `asset_id` berdasarkan nama: **`<asset_id>.<ext>`** (carousel: `<asset_id>_card<n>.<ext>`).
  - File dengan nama lain: tampilkan dan minta user mengonfirmasi pemetaannya. Setelah dikonfirmasi, sarankan rename agar nama = `asset_id`.
  - Aset yang belum ada → `status: pending`.

## Langkah 2 — Pemeriksaan mekanis
Untuk setiap file lokal (unduh ke `temp/qa/` jika dari URL):
- **Video:** `ffprobe` untuk resolusi, durasi, dan codec.
- **Gambar:** ukuran piksel (mis. Python PIL / `identify`).
- Bandingkan dengan `deliverables` di JSON: rasio, `size_px`, `duration_s` (toleransi ±0,5 detik), `file_type`, dan `max_file_mb`.
- Isi baris manifest. Yang tidak sesuai → `status: revise` dengan alasannya.

## Langkah 3 — QA visual
1. Siapkan bahan di `temp/qa/` (di-gitignore):
   - gambar;
   - frame video di detik 0,5 / 1,5 / 2,9 / tengah / akhir, mis. `ffmpeg -ss <t> -i <file> -frames:v 1 temp/qa/<asset_id>-<t>s.png`.
2. Panggil **Agent** `daekan-meta-ads:creative-qa` (fallback: `creative-qa`):
   ```
   Mode aset. Review briefs/assets-ready.md terhadap briefs/handoff/*.json (deliverables, copy, storyboard/layout,
   brand, do/dont, acceptance_criteria). Gambar & frame ada di temp/qa/ (baca dengan Read).
   Tulis instruksi revisi per aset yang bisa langsung dikirim ke Video Editor/Designer.
   ```
3. Tempel hasilnya ke `## Hasil QA`, dan instruksi revisi per aset ke `## Catatan Revisi`.

## Langkah 4 — Siklus revisi
- Untuk aset `revise`: tampilkan **catatan revisi siap kirim**, dikelompokkan per penerima (Video Editor / Designer). User mengirimkannya ke plugin produksi.
- Setelah file baru diterima, ulangi Langkah 1–3 hanya untuk aset tersebut.
- Perubahan **konsep atau copy** bukan revisi produksi. Arahkan ke `/daekan-meta-ads:3-creative-brief`.

## Langkah 5 — APPROVED
- Syarat:
  - semua aset `ready`;
  - gate CLI tanpa ERROR;
  - **Verdict batch: PASS**.
- Tampilkan manifest final, lalu tanyakan **"Setujui semua aset batch `<batch_id>` untuk launch?"**.
- Jika ya, set `status: approved` lalu jalankan gate CLI sekali lagi.

## Larangan
- DILARANG mengedit, me-render ulang, atau men-generate aset. Plugin hanya memeriksa.
- DILARANG mengubah copy/konsep brief di fase ini.
- DILARANG meng-commit file aset/render ke repo.

## Selesai
Laporkan jumlah aset `ready`/`revise`/`pending` dan status manifest. Langkah berikutnya: **`/daekan-meta-ads:5-launch`**.
