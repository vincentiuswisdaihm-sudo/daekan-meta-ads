---
name: 3-produksi
description: Fase 3 pipeline daekan-meta-ads. Hanya berjalan jika briefs/batch-latest.md sudah approved; membaca briefs/lp-sync.md (jika approved untuk batch yang sama) agar palet, hero/mockup, dan message-match selaras dengan landing page. Produksi dua jalur — (a) static ads & mockup lewat AI Image Generator Daekan setelah estimasi token dikonfirmasi user (maks 4 gambar/batch), (b) video ads 9:16 & 4:5 lewat Remotion memakai hook dari brief dan URL gambar Daekan, lalu batch-render. Hasil (URL Asset Library Daekan + path video) dicatat di briefs/assets-ready.md dan diaudit creative-qa.
argument-hint: "[a|b|all] — jalur yang dijalankan (default: all)"
disable-model-invocation: true
---

# 3 · Produksi — Dual-Engine (Daekan + Remotion)

Output tunggal fase ini adalah **`briefs/assets-ready.md`** dengan `status: approved`.

**Kontrak yang mengikat:** `ARCHITECTURE.md` §2 (kontrak file, termasuk `briefs/lp-sync.md`), §4 (dual-engine; §4.1 butir 6 untuk aset LP), §5 (keamanan), §6 (quality gate). Baca dulu sebelum mulai.

Argumen: `$ARGUMENTS`. Isinya `a` (hanya gambar), `b` (hanya video, butuh jalur A sudah selesai), atau kosong/`all`.

**Quality gate CLI:** `node <root-plugin>/hooks/scripts/brief-gate.mjs <file>`. `<root-plugin>` = dua folder di atas base directory skill ini, atau `${CLAUDE_PLUGIN_ROOT}`.

---

## Langkah 0 — GATE (wajib, jalankan paling awal)

1. Jika `briefs/batch-latest.md` **tidak ada**, atau front-matter `status` **bukan `approved`**, **TOLAK** dan berhenti:
   > Fase 3 tidak bisa dijalankan: `briefs/batch-latest.md` belum APPROVED. Selesaikan `/daekan-meta-ads:2-strategi` (QA PASS + persetujuan) terlebih dahulu.
2. Jalankan gate CLI pada `briefs/batch-latest.md`. Jika ada **ERROR**, TOLAK dengan alasan yang sama. **Jangan memperbaiki brief di fase ini.**
3. Ambil `batch_id`, daftar `ad_name`, `## Prompt Visual Daekan`, `## Storyboard Remotion`, dan hook verbatim dari brief.
4. Jika `briefs/assets-ready.md` sudah ada dengan `batch_id` berbeda, arsipkan ke `briefs/archive/<batch_id-lama>-assets.md`. Jika `batch_id`-nya sama, **lanjutkan** dari file tersebut (resume) dan jangan generate ulang aset yang sudah punya URL.
5. Buat atau perbarui `briefs/assets-ready.md` (`phase: production`, `status: draft`, `generated_by: 3-produksi`, `source_file: briefs/batch-latest.md`) dengan kerangka section ARCHITECTURE.md §2.4. Isi `## Manifest Aset` dengan satu baris per `ad_name` dari brief, status `pending`.
6. **Sinkronisasi landing page (Fase 2B).**
   - **Jika `briefs/lp-sync.md` ada, `status: approved`, dan `batch_id` sama dengan brief**, baca:
     - `## Visual & Palet`: token warna (hex), font, gaya, dan aset hero/mockup Daekan.
     - `## Blueprint & Revisi LP` / `## Message-Match`: headline, sub-headline, dan CTA above-the-fold LP final.

     Data ini menjadi **sumber selaras** untuk Jalur A dan B (lihat butir "Selaras LP" di masing-masing jalur).
   - **Jika `lp-sync.md` ada tetapi `batch_id` berbeda atau belum `approved`**, abaikan isinya dan beri tahu user.
   - **Jika `lp-sync.md` tidak ada**, lanjutkan tanpa sinkronisasi, dan ingatkan user bahwa `/daekan-meta-ads:4-launch` tetap mewajibkan `/daekan-meta-ads:2b-landing-page` selesai untuk batch ini.

---

## Jalur A — Static Ads & Mockup (AI Image Generator Daekan)

1. **Susun daftar generate** dari `## Prompt Visual Daekan` (≤ 4 prompt). Satu prompt = satu gambar. Tampilkan tabel:
   `# | prompt (ringkas) | rasio | resolusi | dipakai oleh (ad_name static / scene video)`

   Jika `lp-sync.md` disinkronkan, jalankan butir 5 (**Selaras LP**) **sekarang**, sebelum langkah 2. Aset LP yang dipakai ulang dikeluarkan dari daftar generate.
2. **Estimasi token.** Gunakan tool estimasi/harga dari Daekan Katalisa MCP. Jika tidak ada tool khusus, pakai tarif per gambar dari deskripsi tool atau pengaturan akun Daekan. Tampilkan estimasi per gambar dan totalnya, serta saldo token jika tersedia. Jika estimasi benar-benar tidak bisa diperoleh, tulis **"estimasi tidak tersedia dari Daekan"**. Konfirmasi tetap wajib.
3. **Minta konfirmasi eksplisit:**
   > Generate `<n>` gambar via AI Image Generator Daekan dengan estimasi `<x>` token? (ya/tidak)

   Tanpa jawaban "ya" di percakapan ini, **DILARANG generate**. Jika saldo kurang, berhenti dan laporkan.
4. **Generate** satu per satu lewat tool image generation Daekan. Pakai prompt dari brief apa adanya (positif + negative prompt + rasio). Pastikan setiap hasil tersimpan di **Asset Library Daekan** dan catat URL permanennya.
   - Gagal atau hasil buruk: **jangan retry otomatis**. Regenerate = generate baru, jadi wajib estimasi dan konfirmasi ulang dan tetap dihitung dalam batas 4 gambar per batch.
   - DILARANG memakai generator lain (Higgsfield, ElevenLabs, Figma, Canva AI, DALL·E, dll.).
5. **Selaras LP** (jika `lp-sync.md` disinkronkan di Langkah 0.6):
   - **Sebelum estimasi token**, cek apakah hero image atau mockup dari `lp-sync.md` bisa langsung dipakai, mis. sebagai mockup produk di static ad atau scene video. Aset LP yang dipakai ulang **tidak di-generate ulang** dan tidak memakai token. Catat di `## Aset Daekan` dengan `prompt` berawalan `lp-` (mis. `lp-hero`, `lp-mockup`). Baris ini tidak dihitung dalam batas 4 (ARCHITECTURE.md §4.1 butir 6).
   - Untuk prompt yang tetap di-generate, tampilkan ke user apakah palet/gaya prompt brief konsisten dengan `## Visual & Palet` LP. **Jangan mengubah prompt brief tanpa persetujuan user.** Jika user setuju menyesuaikan, catat perubahannya di `## Estimasi & Konsumsi Token Daekan`.
6. **Catat** di `briefs/assets-ready.md`:
   - `## Aset Daekan`: `| prompt | daekan_asset_url | rasio | dipakai_oleh |`, satu baris per gambar (termasuk baris `lp-…` yang dipakai ulang).
   - `## Manifest Aset`: baris static ad → `engine: daekan`, `daekan_asset_url`, `rasio`, `status: ready`.
   - `## Estimasi & Konsumsi Token Daekan`: estimasi yang dikonfirmasi vs konsumsi aktual.

---

## Jalur B — Video Ads (Remotion)

Prasyarat: semua gambar yang dirujuk storyboard sudah punya `daekan_asset_url` (Jalur A selesai). Jika belum, jalankan Jalur A dulu atau berhenti.

1. **Muat skill Remotion.** Panggil skill `remotion:remotion-best-practices` (router), lalu sub-skill yang relevan. Ikuti konvensinya.
2. **Proyek Remotion** ada di folder `video/` pada working directory:
   - Jika belum ada, buat lewat skill `remotion:remotion-create` (template TypeScript blank) di `video/`.
   - Pastikan ada dua komposisi (buat atau update, jangan duplikasi):

     | id komposisi | Ukuran | fps | Dipakai untuk |
     |---|---|---|---|
     | `Ad916` | 1080×1920 | 30 | `vid916` (Reels/Stories) |
     | `Ad45` | 1080×1350 | 30 | `vid45` (Feed) |

   - Keduanya memakai **satu komponen** yang sama, dengan props tervalidasi `zod`:
     ```ts
     {
       adName: string;                 // = ad_name / utm_content
       hook: string;                   // teks hook VERBATIM dari brief, tampil frame 0–90
       scenes: { imageUrl: string;     // HANYA URL Asset Library Daekan
                 text: string;
                 durationInFrames: number }[];
       cta: string;                    // teks CTA penutup
       brand: { primary: string; accent: string; fontFamily?: string };
     }
     ```
   - Durasi dihitung lewat `calculateMetadata` dari jumlah `scenes` + hook + CTA.
   - Gambar dimuat dengan `<Img>` dari `remotion` (menunggu load sebelum render).
   - **Safe zone:** teks tidak boleh di ±14% atas dan ±20% bawah pada 9:16, dan ±8% atas/bawah pada 4:5.
   - Hook harus terbaca dalam 3 detik pertama: font besar, kontras tinggi, maksimal ±10 kata.
3. **Props per ad.** Untuk setiap `ad_name` video di brief, tulis `video/props/<ad_name>.json`:
   - `hook` dan teks scene diambil **verbatim** dari `## Konsep Kreatif` dan `## Storyboard Remotion`.
   - `imageUrl` hanya boleh berasal dari `## Aset Daekan` (termasuk baris `lp-…`). Jika storyboard merujuk aset yang tidak ada, berhenti dan laporkan. **DILARANG memakai aset dari sumber lain.**
   - **Selaras LP** (jika `lp-sync.md` disinkronkan):
     - `brand.primary`, `brand.accent`, dan `brand.fontFamily` diambil dari `## Visual & Palet` LP, supaya video terlihat menyatu dengan halaman tujuan.
     - Bandingkan `hook` dan `cta` (verbatim dari brief) dengan headline dan CTA above-the-fold LP final. Jika janjinya berbeda (skor message-match < 4 untuk `ad_name` ini di `lp-sync.md`), **laporkan ke user sebelum render**. Teks brief tetap dipakai verbatim; perubahan copy dilakukan lewat `/daekan-meta-ads:2-strategi` atau `/daekan-meta-ads:2b-landing-page`.
4. **Preview (opsional).** Tawarkan Remotion Studio ke user. Lewati jika user ingin langsung render.
5. **Batch-render** semua video (ikuti skill `remotion:remotion-render`). Dari folder `video/`:
   ```bash
   npx remotion render src/index.ts <Ad916|Ad45> ../renders/<batch_id>/<ad_name>.mp4 --props=./props/<ad_name>.json --codec=h264
   ```
   Render berurutan. Jika satu render gagal, catat errornya, lanjutkan ke render berikutnya, lalu laporkan semua kegagalan di akhir.
6. **Verifikasi** setiap file: ada, ukuran > 0, dan jika `ffprobe` tersedia, resolusi (1080×1920 / 1080×1350) serta durasinya sesuai.
7. **Catat** di `briefs/assets-ready.md`:
   - `## Manifest Aset`: baris video → `engine: remotion`, `daekan_asset_url` = URL Daekan yang dipakai (pisahkan dengan koma), `render_path`, `durasi`, `rasio`, `status: ready` atau `failed`.
   - `## Catatan Render Remotion`: id komposisi, resolusi, fps, durasi, path props.

---

## Langkah Akhir — QA & APPROVED

1. Jalankan gate CLI pada `briefs/assets-ready.md` dan perbaiki semua **ERROR** (mis. engine tidak valid, URL atau path yang hilang).
2. Siapkan bahan visual untuk QA di `temp/qa/` (folder ini di-gitignore):
   - Unduh tiap gambar Daekan.
   - Jika `ffmpeg` tersedia, ekstrak frame video di detik 0,5 / 1,5 / 2,9 / tengah / akhir:
     ```bash
     ffmpeg -ss <t> -i <render_path> -frames:v 1 temp/qa/<ad_name>-<t>s.png
     ```
3. Panggil **Agent** `daekan-meta-ads:creative-qa` (fallback: `creative-qa`):
   ```
   Mode aset. Review briefs/assets-ready.md terhadap briefs/batch-latest.md
   (dan briefs/lp-sync.md untuk konsistensi palet & message-match, jika approved untuk batch ini).
   Gambar & frame untuk dinilai ada di temp/qa/ (baca dengan Read).
   ```
   Tempel hasilnya ke `## Hasil QA`.
4. **REVISE / FAIL:**
   - Masalah video (teks, timing, safe zone): perbaiki komposisi/props → render ulang → QA ulang.
   - Masalah gambar: perlu regenerate, jadi **wajib estimasi dan konfirmasi ulang** (Jalur A langkah 2–3).
   - Maksimal 3 putaran, setelah itu berhenti dan minta arahan user.
5. **PASS:** tampilkan manifest final ke user dan tanyakan **"Setujui aset batch `<batch_id>` untuk launch?"**. Jika ya, set `status: approved` lalu jalankan gate CLI sekali lagi (harus lolos tanpa ERROR).

## Larangan

- DILARANG generate gambar tanpa estimasi token dan konfirmasi "ya", dan DILARANG melebihi 4 gambar per batch.
- DILARANG membuat video dengan tool selain Remotion, atau memakai visual selain aset Daekan.
- DILARANG menyentuh Meta Ads di fase ini.
- DILARANG commit file render. `out/`, `renders/`, dan `temp/` sudah di-gitignore.

## Selesai

Laporkan jumlah gambar Daekan (generate vs pakai ulang dari LP), jumlah video ter-render, token terpakai, dan status. Langkah berikutnya: **`/daekan-meta-ads:4-launch`**. Jika `briefs/lp-sync.md` belum approved untuk batch ini, jalankan **`/daekan-meta-ads:2b-landing-page`** dulu.
