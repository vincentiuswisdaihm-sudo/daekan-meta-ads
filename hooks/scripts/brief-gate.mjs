#!/usr/bin/env node
// Quality gate untuk file kontrak di briefs/ (ARCHITECTURE.md §2–§6):
//   briefs/lp-sync.md         (phase: landing-page)
//   briefs/creative-brief.md  (phase: creative-brief) — copy Meta, anti-similarity, pasangan JSON
//   briefs/handoff/*.json     (spesifikasi produksi per aset untuk Video Editor / Designer)
//   briefs/assets-ready.md    (phase: asset-intake) — aset hasil produksi luar
//
// Dua mode:
//   1. Hook PostToolUse (stdin = JSON event Claude Code). Hanya briefs/*.md dan
//      briefs/handoff/*.json (bukan briefs/archive/). Error -> exit 2 + stderr;
//      hanya peringatan -> exit 0 + additionalContext.
//   2. CLI: node brief-gate.mjs <file> [...]. Exit 1 jika ada error.
//
// Tanpa dependensi eksternal (Node >= 18).

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const POLICY_FILE = join(HERE, "..", "policy-terms.json");

// ── Kontrak UTM (ARCHITECTURE.md §3.4) ────────────────────────────────────
const UTM_REGEX = /^[a-z0-9-]+(_[a-z0-9-]+)*$/;
const MAX_LEN = 100;
const ENUM = {
  objektif: ["sales", "leads", "traffic", "engagement", "awareness", "app"],
  funnel: ["tof", "mof", "bof", "rt"],
  format: ["img11", "img45", "img916", "vid916", "vid45", "car"],
  placement: ["advplus", "feed", "reels", "stories", "manual"],
};
const KEY_KIND = { utm_campaign: "campaign", utm_term: "term", utm_content: "content", ad_name: "content" };
const REQUIRED_FM = ["batch_id", "phase", "status", "generated_at", "generated_by", "source_file"];
const PHASES = ["research", "landing-page", "creative-brief", "asset-intake", "launch"];
const FILE_PHASE = { "lp-sync.md": "landing-page", "creative-brief.md": "creative-brief", "assets-ready.md": "asset-intake" };
const SOURCE_FILE = {
  "landing-page": "research/latest.md",
  "creative-brief": "briefs/lp-sync.md",
  "asset-intake": "briefs/creative-brief.md",
};
const PIXEL_ACTIVE = /^(active|aktif)$/i;

// ── Kontrak handoff produksi (ARCHITECTURE.md §4) ─────────────────────────
const FORMAT_SPEC = {
  vid916: { asset_type: "video", ratio: "9:16", recipient: "video-editor" },
  vid45: { asset_type: "video", ratio: "4:5", recipient: "video-editor" },
  img11: { asset_type: "static", ratio: "1:1", recipient: "designer" },
  img45: { asset_type: "static", ratio: "4:5", recipient: "designer" },
  img916: { asset_type: "static", ratio: "9:16", recipient: "designer" },
  car: { asset_type: "carousel", ratio: "1:1", recipient: "designer" },
};
const ASSET_TYPES = ["video", "static", "carousel", "lp-hero", "lp-mockup"];
const RECIPIENTS = ["video-editor", "designer"];
const RATIOS = ["9:16", "4:5", "1:1", "1.91:1", "4:3", "16:9", "3:2"];
const LP_ASSET_ID = /^b\d{6}(-\d+)?_lp-(hero|mockup)(-[a-z0-9]+)?_v\d+$/;
const MAX_VIDEO_S = 60;
const META_CTA = [
  "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "DOWNLOAD", "SUBSCRIBE", "GET_OFFER", "ORDER_NOW", "BUY_NOW",
  "CONTACT_US", "APPLY_NOW", "BOOK_NOW", "GET_QUOTE", "REGISTER_NOW", "SEE_MORE", "WATCH_MORE",
  "SEND_WHATSAPP_MESSAGE", "WHATSAPP_MESSAGE", "MESSAGE_PAGE", "GET_STARTED", "INSTALL_APP",
];
const META_LIMITS = { primary_text: 125, headline: 40, description: 30 };
const MAX_VARIATIONS = 5;
const DIVERSITY_KEYS = ["angle", "persona", "hook_type", "format", "visual_world", "emotional_tone", "offer_framing"];
const DIVERSITY_MUST_DIFFER = ["angle", "hook_type", "visual_world"];
const MIN_DIFFERENT_DIMS = 4;
const SIM_ERROR = 0.5;
const SIM_WARN = 0.35;

function isValidDate(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd)) return false;
  const y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateName(kind, value, fmBatchId) {
  const errs = [];
  if (value.length > MAX_LEN) errs.push(`lebih dari ${MAX_LEN} karakter (${value.length})`);
  if (/-\s*copy$/i.test(value) || /\scopy$/i.test(value)) errs.push("mengandung sufiks duplikasi '- Copy'");
  if (!UTM_REGEX.test(value)) {
    errs.push("tidak cocok regex ^[a-z0-9-]+(_[a-z0-9-]+)*$ (huruf kecil, '-' dalam token, '_' antar token)");
    return errs;
  }
  const t = value.split("_");
  if (kind === "campaign") {
    if (t.length !== 4) return [...errs, `butuh 4 token {produk}_{objektif}_{funnel}_{yyyymmdd}, ditemukan ${t.length}`];
    if (!ENUM.objektif.includes(t[1])) errs.push(`objektif '${t[1]}' bukan salah satu dari ${ENUM.objektif.join("|")}`);
    if (!ENUM.funnel.includes(t[2])) errs.push(`funnel '${t[2]}' bukan salah satu dari ${ENUM.funnel.join("|")}`);
    if (!isValidDate(t[3])) errs.push(`tanggal '${t[3]}' bukan yyyymmdd yang valid`);
  } else if (kind === "term") {
    if (t.length !== 3) return [...errs, `butuh 3 token {audiens}_{geo}_{placement}, ditemukan ${t.length}`];
    if (!/^([a-z]{2}|multi)$/.test(t[1])) errs.push(`geo '${t[1]}' harus kode ISO-3166 alpha-2 huruf kecil atau 'multi'`);
    if (!ENUM.placement.includes(t[2])) errs.push(`placement '${t[2]}' bukan salah satu dari ${ENUM.placement.join("|")}`);
  } else if (kind === "content") {
    if (t.length !== 5) return [...errs, `butuh 5 token {batch_id}_{angle}_{hook}_{format}_v{n}, ditemukan ${t.length}`];
    if (!/^b\d{6}(-\d+)?$/.test(t[0])) errs.push(`batch_id '${t[0]}' harus bYYMMDD (opsional -n)`);
    else if (fmBatchId && t[0] !== fmBatchId) errs.push(`batch_id '${t[0]}' berbeda dengan front-matter '${fmBatchId}'`);
    if (!/^h\d+$/.test(t[2])) errs.push(`hook '${t[2]}' harus h1, h2, ...`);
    if (!ENUM.format.includes(t[3])) errs.push(`format '${t[3]}' bukan salah satu dari ${ENUM.format.join("|")}`);
    if (!/^v\d+$/.test(t[4])) errs.push(`versi '${t[4]}' harus v1, v2, ...`);
  }
  return errs;
}

// ── Kemiripan teks (anti Meta similarity) ─────────────────────────────────
function trigrams(text) {
  const w = String(text || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const set = new Set();
  if (w.length < 3) { if (w.length) set.add(w.join(" ")); return set; }
  for (let i = 0; i + 2 < w.length; i++) set.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return set;
}
function jaccard(a, b) {
  const A = trigrams(a), B = trigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── Parsing markdown ──────────────────────────────────────────────────────
function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: null, bodyStart: 0 };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*(#.*)?$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return { fm, bodyStart: m[0].split(/\r?\n/).length - 1 };
}

const PLACEHOLDER = /^(pending|tbd|todo|n\/a|na|null|-|—|–)$/i;
const clean = (s) => s.trim().replace(/^[`*_\s]+|[`*_\s]+$/g, "").trim();
function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function analyse(text) {
  const lines = text.split(/\r?\n/);
  const { fm, bodyStart } = parseFrontMatter(text);
  const names = [], tables = [], policyLines = [];
  const sections = {}, subsections = {}, kvs = {};
  let section = "", sub = "";
  let inFence = false;

  for (let i = bodyStart; i < lines.length; i++) {
    const raw = lines[i];
    const ln = i + 1;
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h2 = raw.match(/^##\s+(.+?)\s*$/);
    if (h2) { section = h2[1].trim(); sections[section] = []; sub = ""; continue; }
    const h3 = raw.match(/^###\s+(.+?)\s*$/);
    if (h3) { sub = h3[1].trim(); subsections[sub] = { lines: [], line: ln, section }; }
    else if (sub) subsections[sub].lines.push({ text: raw, line: ln });
    if (section) sections[section].push(raw);

    if (/^\s*\|/.test(raw) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const headers = splitRow(raw).map((h) => clean(h).toLowerCase());
      const tbl = { headers, rows: [], section, line: ln };
      let j = i + 2;
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        tbl.rows.push({ cells: splitRow(lines[j]).map(clean), line: j + 1 });
        j++;
      }
      tables.push(tbl);
      headers.forEach((h, idx) => {
        if (!KEY_KIND[h]) return;
        for (const r of tbl.rows) {
          const v = r.cells[idx] ?? "";
          if (v && !PLACEHOLDER.test(v) && !/[{<]/.test(v)) names.push({ kind: KEY_KIND[h], value: v, line: r.line });
        }
      });
    }

    const kv = raw.match(/^\s*(?:[-*+]\s+)?\**`?(utm_campaign|utm_term|utm_content|ad_name)`?\**\s*:\s*\**\s*(?:`([^`]+)`|([^\s|*]+))/i);
    if (kv) {
      const v = (kv[2] ?? kv[3] ?? "").trim();
      if (v && !PLACEHOLDER.test(v) && !/[{<]/.test(v)) names.push({ kind: KEY_KIND[kv[1].toLowerCase()], value: v, line: ln });
    }
    const gkv = raw.match(/^\s*(?:[-*+]\s+)?\**`?([a-z][a-z0-9_]*)`?\**\s*:\s*\**\s*(?:`([^`]*)`|(\S[^|]*?))\s*$/i);
    if (gkv) {
      const key = gkv[1].toLowerCase();
      if (!(key in kvs)) kvs[key] = { value: (gkv[2] ?? gkv[3] ?? "").trim(), line: ln };
    }

    const isQA = /^hasil\s+qa/i.test(section);
    const isUnchosen = /^konsep\s+tidak\s+dipilih/i.test(section);
    const isNegative = /^\s*(?:[-*+]\s+)?\**(negative(\s+prompt)?|negatif)\**\s*:/i.test(raw);
    if (!isQA && !isUnchosen && !isNegative && !/qa-ignore/i.test(raw)) policyLines.push({ text: raw, line: ln, section });
  }
  return { fm, names, tables, policyLines, sections, subsections, kvs };
}

let POLICY_CACHE;
function loadPolicy() {
  if (POLICY_CACHE) return POLICY_CACHE;
  try {
    const p = JSON.parse(readFileSync(POLICY_FILE, "utf8"));
    const compile = (arr) => (arr || []).map((t) => ({ re: new RegExp(t.pattern, "i"), reason: t.reason }));
    POLICY_CACHE = { high: compile(p.high), medium: compile(p.medium) };
  } catch (e) {
    POLICY_CACHE = { high: [], medium: [], loadError: `Gagal membaca ${POLICY_FILE}: ${e.message}` };
  }
  return POLICY_CACHE;
}
function scanPolicy(text, where, errors, warnings, { downgrade = false } = {}) {
  const policy = loadPolicy();
  for (const { re, reason } of policy.high) {
    const m = String(text).match(re);
    if (!m) continue;
    if (downgrade) warnings.push(`${where}: LP saat ini memuat frasa rawan "${m[0]}" — ${reason}. Wajib direvisi sebelum approved.`);
    else errors.push(`${where}: frasa rawan policy "${m[0]}" — ${reason}.`);
  }
  for (const { re, reason } of policy.medium) {
    const m = String(text).match(re);
    if (m) warnings.push(`${where}: frasa perlu dicek "${m[0]}" — ${reason}.`);
  }
}

function hasQaPass(sections) {
  const qaSec = Object.keys(sections).find((s) => /^hasil\s+qa/i.test(s));
  const qaText = qaSec ? sections[qaSec].join("\n") : "";
  return /verdict\s+batch\s*:?\**\s*:?\s*\**\s*PASS\b(?![ \t]*\|)/i.test(qaText);
}
function readFm(path) {
  try { return parseFrontMatter(readFileSync(path, "utf8")).fm; } catch { return null; }
}

// ── Handoff JSON (spesifikasi produksi per aset) ──────────────────────────
function loadHandoff(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json") || f === "index.json") continue;
    const p = join(dir, f);
    try { out.push({ file: f, path: p, data: JSON.parse(readFileSync(p, "utf8")) }); }
    catch (e) { out.push({ file: f, path: p, parseError: e.message }); }
  }
  return out;
}

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function checkHandoff(file, { siblingCheck = true } = {}) {
  const errors = [], warnings = [];
  const name = basename(file);
  let d;
  try { d = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { return { errors: [`JSON tidak valid: ${e.message}`], warnings }; }
  if (!d || typeof d !== "object" || Array.isArray(d)) return { errors: ["JSON harus berupa object (satu aset per file)."], warnings };

  const E = (m) => errors.push(m);
  if (d.schema_version !== "1.0") E(`schema_version harus "1.0" (schemas/creative-brief.schema.json).`);
  for (const k of ["batch_id", "status", "asset_id", "concept_id", "asset_type", "recipient"]) if (!isStr(d[k])) E(`field wajib '${k}' kosong/tidak ada.`);
  if (isStr(d.batch_id) && !/^b\d{6}(-\d+)?$/.test(d.batch_id)) E(`batch_id '${d.batch_id}' harus bYYMMDD (opsional -n).`);
  if (isStr(d.status) && !["draft", "approved", "rejected"].includes(d.status)) E(`status '${d.status}' harus draft | approved | rejected.`);
  if (isStr(d.asset_type) && !ASSET_TYPES.includes(d.asset_type)) E(`asset_type '${d.asset_type}' harus ${ASSET_TYPES.join(" | ")}.`);
  if (isStr(d.recipient) && !RECIPIENTS.includes(d.recipient)) E(`recipient '${d.recipient}' harus ${RECIPIENTS.join(" | ")}.`);
  if (isStr(d.asset_id) && name !== `${d.asset_id}.json`) E(`nama file '${name}' wajib sama dengan asset_id ('${d.asset_id}.json').`);

  const isLp = d.asset_type === "lp-hero" || d.asset_type === "lp-mockup";
  let spec;
  if (isLp) {
    if (isStr(d.asset_id) && !LP_ASSET_ID.test(d.asset_id)) E(`asset_id LP '${d.asset_id}' harus pola {batch_id}_lp-hero|lp-mockup[-label]_v{n}.`);
    if (d.recipient && d.recipient !== "designer") E(`aset LP wajib recipient 'designer'.`);
    if (d.ad_name) E(`aset LP bukan iklan: hapus field ad_name.`);
  } else {
    if (!isStr(d.ad_name)) E(`aset iklan wajib field ad_name (= utm_content).`);
    else {
      if (d.ad_name !== d.asset_id) E(`ad_name '${d.ad_name}' wajib sama dengan asset_id '${d.asset_id}'.`);
      for (const e of validateName("content", d.ad_name, d.batch_id)) E(`ad_name '${d.ad_name}' — ${e}.`);
      const fmt = d.ad_name.split("_")[3];
      spec = FORMAT_SPEC[fmt];
      if (spec) {
        if (d.asset_type && d.asset_type !== spec.asset_type) E(`format '${fmt}' di ad_name menuntut asset_type '${spec.asset_type}', ditemukan '${d.asset_type}'.`);
        if (d.recipient && d.recipient !== spec.recipient) E(`format '${fmt}' menuntut recipient '${spec.recipient}', ditemukan '${d.recipient}'.`);
      }
    }
  }

  // deliverables
  if (!Array.isArray(d.deliverables) || !d.deliverables.length) E(`deliverables[] wajib berisi minimal satu spesifikasi file.`);
  else d.deliverables.forEach((x, i) => {
    const at = `deliverables[${i}]`;
    if (!RATIOS.includes(x?.ratio)) E(`${at}.ratio '${x?.ratio}' harus salah satu dari ${RATIOS.join(", ")}.`);
    if (!/^\d{3,4}x\d{3,4}$/.test(String(x?.size_px ?? ""))) E(`${at}.size_px harus 'LEBARxTINGGI', mis. 1080x1920.`);
    else if (RATIOS.includes(x.ratio)) {
      const [w, h] = x.size_px.split("x").map(Number), [rw, rh] = x.ratio.split(":").map(Number);
      if (Math.abs(w / h - rw / rh) > 0.02) E(`${at}: size_px ${x.size_px} tidak sesuai rasio ${x.ratio}.`);
    }
    if (!isStr(x?.file_type)) E(`${at}.file_type wajib (mp4 | mov | png | jpg).`);
    if (d.asset_type === "video") {
      if (!isNum(x?.duration_s) || x.duration_s <= 0) E(`${at}.duration_s wajib untuk video.`);
      else if (x.duration_s > MAX_VIDEO_S) E(`${at}.duration_s ${x.duration_s} melebihi batas ${MAX_VIDEO_S} detik.`);
    }
  });
  if (spec && Array.isArray(d.deliverables) && d.deliverables[0] && d.deliverables[0].ratio !== spec.ratio)
    E(`deliverables[0].ratio '${d.deliverables[0].ratio}' tidak sesuai format ad_name (${spec.ratio}).`);

  // copy Meta + diversity (khusus iklan)
  if (!isLp) {
    const meta = d.copy?.meta;
    if (!meta || typeof meta !== "object") E(`copy.meta (primary_text, headline, description, cta) wajib ada.`);
    else {
      for (const k of Object.keys(META_LIMITS)) {
        if (!isStr(meta[k])) { E(`copy.meta.${k} wajib diisi (siap copy-paste ke Meta).`); continue; }
        if ([...meta[k]].length > META_LIMITS[k]) E(`copy.meta.${k} ${[...meta[k]].length} karakter; maksimal ${META_LIMITS[k]}.`);
      }
      if (!META_CTA.includes(meta.cta)) E(`copy.meta.cta '${meta.cta}' bukan CTA Meta yang dikenal (${META_CTA.slice(0, 6).join(", ")}, ...).`);
      if (meta.variations) for (const k of Object.keys(META_LIMITS)) {
        const arr = meta.variations[k];
        if (arr === undefined) continue;
        if (!Array.isArray(arr)) { E(`copy.meta.variations.${k} harus array.`); continue; }
        if (arr.length > MAX_VARIATIONS) E(`copy.meta.variations.${k} berisi ${arr.length}; maksimal ${MAX_VARIATIONS} (batas Meta).`);
        arr.forEach((v, i) => { if ([...String(v)].length > META_LIMITS[k]) E(`copy.meta.variations.${k}[${i}] melebihi ${META_LIMITS[k]} karakter.`); });
      }
    }
    if (!isStr(d.copy?.hook_on_screen)) E(`copy.hook_on_screen wajib (teks hook ≤ 3 detik / teks utama di gambar).`);
    const div = d.diversity;
    if (!div || typeof div !== "object") E(`diversity {${DIVERSITY_KEYS.join(", ")}} wajib ada (anti Meta similarity).`);
    else for (const k of DIVERSITY_KEYS) if (!isStr(div[k])) E(`diversity.${k} wajib diisi.`);
  }

  // isi produksi per tipe
  if (d.asset_type === "video") {
    const sb = d.storyboard;
    if (!Array.isArray(sb) || !sb.length) E(`storyboard[] wajib untuk video.`);
    else {
      sb.forEach((s, i) => {
        for (const k of ["visual", "on_screen_text"]) if (typeof s?.[k] !== "string") E(`storyboard[${i}].${k} wajib (boleh string kosong untuk on_screen_text).`);
        if (!isNum(s?.start_s) || !isNum(s?.end_s) || s.end_s <= s.start_s) E(`storyboard[${i}]: start_s/end_s tidak valid.`);
        if (i > 0 && isNum(s?.start_s) && isNum(sb[i - 1]?.end_s) && Math.abs(s.start_s - sb[i - 1].end_s) > 0.05) E(`storyboard[${i}].start_s harus sama dengan end_s scene sebelumnya.`);
      });
      if (sb[0]?.start_s !== 0) E(`storyboard[0].start_s harus 0.`);
      const hook = sb.filter((s) => isNum(s?.start_s) && s.start_s < 3).map((s) => s.on_screen_text || "").join(" ").trim();
      if (!hook) E(`tidak ada on_screen_text di 3 detik pertama (hook wajib terbaca ≤ 3 detik).`);
      const dur = d.deliverables?.[0]?.duration_s;
      const last = sb[sb.length - 1]?.end_s;
      if (isNum(dur) && isNum(last) && Math.abs(dur - last) > 0.5) E(`durasi storyboard (${last}s) tidak sama dengan deliverables[0].duration_s (${dur}s).`);
    }
    if (!d.safe_zone || typeof d.safe_zone !== "object") E(`safe_zone wajib untuk video.`);
  }
  if (d.asset_type === "static" || d.asset_type === "carousel" || isLp) {
    if (!d.layout || typeof d.layout !== "object") E(`layout wajib untuk ${d.asset_type} (hierarki, teks on-image, CTA, safe zone).`);
    if (d.asset_type === "carousel" && (!Array.isArray(d.layout?.cards) || d.layout.cards.length < 2 || d.layout.cards.length > 10))
      E(`carousel wajib layout.cards[] berisi 2–10 kartu.`);
  }

  // brand, referensi, kriteria, delivery
  if (!Array.isArray(d.brand?.palette) || !d.brand.palette.length || !d.brand.palette.every((c) => /^#[0-9a-f]{6}$/i.test(c)))
    E(`brand.palette wajib berisi warna hex (#RRGGBB) dari lp-sync.`);
  const lp = d.references?.landing_page_url;
  if (!isStr(lp) || !/^https?:\/\/\S+$/i.test(lp)) E(`references.landing_page_url wajib URL http(s) bersih.`);
  if (!Array.isArray(d.acceptance_criteria) || !d.acceptance_criteria.length) E(`acceptance_criteria[] wajib (kriteria approval aset).`);
  if (!Array.isArray(d.do) || !Array.isArray(d.dont)) E(`do[] dan dont[] wajib ada (boleh kosong).`);
  const expectFile = isStr(d.asset_id) ? d.asset_id : null;
  if (!isStr(d.delivery?.file_name)) E(`delivery.file_name wajib.`);
  else if (expectFile && !new RegExp(`^${expectFile.replace(/[-]/g, "\\-")}(\\.[a-z0-9]+|_card\\d+\\.[a-z0-9]+)$`).test(d.delivery.file_name))
    E(`delivery.file_name '${d.delivery.file_name}' wajib '${expectFile}.<ext>' agar nama aset == ad_name (UTM).`);

  // URL bersih + policy pada seluruh teks
  const json = JSON.stringify(d);
  for (const url of json.match(/https?:\/\/[^\s"'<>|]+/g) || []) if (/utm_/i.test(url)) E(`URL berisi 'utm_' (${url}). UTM hanya lewat url_tags saat launch (§3.2).`);
  const texts = [];
  const walk = (v, path) => {
    if (typeof v === "string") texts.push([path, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["negative_prompt", "dont", "policy_notes"].includes(k)) walk(x, path ? `${path}.${k}` : k);
  };
  walk({ copy: d.copy, storyboard: d.storyboard, layout: d.layout }, "");
  for (const [p, t] of texts) scanPolicy(t, p, errors, warnings);

  // keterkaitan dengan creative-brief.md
  if (siblingCheck) {
    const briefPath = join(dirname(file), "..", "creative-brief.md");
    if (existsSync(briefPath)) {
      const bfm = readFm(briefPath);
      if (bfm?.batch_id && d.batch_id && bfm.batch_id !== d.batch_id) E(`batch_id '${d.batch_id}' berbeda dengan briefs/creative-brief.md ('${bfm.batch_id}').`);
      if (d.status === "approved" && (bfm?.status || "").toLowerCase() !== "approved") E(`status approved hanya boleh setelah briefs/creative-brief.md approved (QA PASS + persetujuan user).`);
      const text = readFileSync(briefPath, "utf8");
      if (isStr(d.asset_id) && !text.includes(d.asset_id)) E(`asset_id '${d.asset_id}' tidak tercantum di briefs/creative-brief.md.`);
    } else warnings.push(`briefs/creative-brief.md belum ada; keterkaitan brief ↔ JSON belum bisa diperiksa.`);
  }
  return { errors, warnings, data: d };
}

// ── Copy Meta di creative-brief.md ────────────────────────────────────────
const COPY_LABELS = [
  ["primary_text_long", /^\**\s*primary\s+text\s*\((panjang|long)\)\s*:?\**\s*:?\s*(.*)$/i],
  ["primary_text", /^\**\s*primary\s+text\s*:?\**\s*:?\s*(.*)$/i],
  ["headline", /^\**\s*headline\s*:?\**\s*:?\s*(.*)$/i],
  ["description", /^\**\s*description\s*:?\**\s*:?\s*(.*)$/i],
  ["cta", /^\**\s*cta(\s+button)?\s*:?\**\s*:?\s*(.*)$/i],
  ["url", /^\**\s*url\s*:?\**\s*:?\s*(.*)$/i],
];
function parseCopyBlock(lines) {
  const out = {};
  let cur = null;
  for (const { text } of lines) {
    const t = text.replace(/^\s*[-*+]\s+/, "").trim();
    let hit = false;
    for (const [key, re] of COPY_LABELS) {
      const m = t.match(re);
      if (m) { cur = key; out[key] = (m[m.length - 1] || "").trim(); hit = true; break; }
    }
    if (!hit && cur && t) out[cur] = (out[cur] ? out[cur] + " " : "") + t;
    if (!t && cur && out[cur]) cur = null;
  }
  for (const k of Object.keys(out)) out[k] = norm(out[k].replace(/^`|`$/g, ""));
  return out;
}

function batchChecks(dir, handoffs, briefFm, errors, warnings) {
  const ads = handoffs.filter((h) => h.data && !["lp-hero", "lp-mockup"].includes(h.data.asset_type));
  // per konsep: diversity & teks representatif
  const concepts = new Map();
  for (const h of ads) {
    const c = h.data.concept_id || h.data.asset_id;
    if (!concepts.has(c)) concepts.set(c, { id: c, div: h.data.diversity || {}, texts: [], files: [] });
    const meta = h.data.copy?.meta || {};
    concepts.get(c).texts.push(meta.primary_text, meta.headline, h.data.copy?.hook_on_screen);
    concepts.get(c).files.push(h.file);
  }
  const list = [...concepts.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    const same = DIVERSITY_MUST_DIFFER.filter((k) => norm(a.div[k]).toLowerCase() && norm(a.div[k]).toLowerCase() === norm(b.div[k]).toLowerCase());
    if (same.length) errors.push(`konsep '${a.id}' dan '${b.id}' sama pada ${same.join(", ")} — wajib berbeda (anti Meta similarity, §3b).`);
    const diff = DIVERSITY_KEYS.filter((k) => norm(a.div[k]).toLowerCase() !== norm(b.div[k]).toLowerCase()).length;
    if (diff < MIN_DIFFERENT_DIMS) errors.push(`konsep '${a.id}' dan '${b.id}' hanya berbeda di ${diff}/7 dimensi diversity; minimal ${MIN_DIFFERENT_DIMS}.`);
    let worst = 0, pair = "";
    for (const ta of a.texts) for (const tb of b.texts) {
      const s = jaccard(ta, tb);
      if (s > worst) { worst = s; pair = `"${norm(ta).slice(0, 40)}…" vs "${norm(tb).slice(0, 40)}…"`; }
    }
    if (worst >= SIM_ERROR) errors.push(`copy konsep '${a.id}' dan '${b.id}' terlalu mirip (Jaccard ${worst.toFixed(2)} ≥ ${SIM_ERROR}): ${pair}.`);
    else if (worst >= SIM_WARN) warnings.push(`copy konsep '${a.id}' dan '${b.id}' agak mirip (Jaccard ${worst.toFixed(2)}): ${pair}.`);
  }
  // vs hook kompetitor / iklan lama di research/latest.md
  const research = join(dir, "..", "research", "latest.md");
  if (existsSync(research)) {
    const ra = analyse(readFileSync(research, "utf8"));
    const old = [];
    for (const t of ra.tables) if (/kompetitor|fatigue/i.test(t.section)) {
      const hi = t.headers.findIndex((h) => /hook/.test(h));
      if (hi >= 0) for (const r of t.rows) if ((r.cells[hi] || "").split(/\s+/).length >= 3) old.push(r.cells[hi]);
    }
    for (const c of list) for (const t of c.texts) for (const o of old) {
      const s = jaccard(t, o);
      if (s >= SIM_ERROR) warnings.push(`copy konsep '${c.id}' mirip hook di research/latest.md (Jaccard ${s.toFixed(2)}): "${norm(o).slice(0, 50)}". Pastikan bukan tiruan/iklan fatigue.`);
    }
  }
}

// ── Pemeriksaan file markdown ─────────────────────────────────────────────
export function checkMarkdown(file) {
  const errors = [], warnings = [];
  const text = readFileSync(file, "utf8");
  const { fm, names, tables, policyLines, sections, subsections, kvs } = analyse(text);
  const fileName = basename(file).toLowerCase();
  const dir = dirname(file);

  if (!fm) errors.push("Front-matter YAML (--- ... ---) tidak ditemukan (ARCHITECTURE.md §2.2).");
  else {
    const missing = REQUIRED_FM.filter((k) => !(k in fm) || fm[k] === "");
    if (missing.length) errors.push(`Front-matter kurang field: ${missing.join(", ")} (ARCHITECTURE.md §2.2).`);
    if (fm.batch_id && !/^b\d{6}(-\d+)?$/.test(fm.batch_id)) errors.push(`batch_id '${fm.batch_id}' harus bYYMMDD (opsional -n).`);
    if (fm.status && !["draft", "approved", "rejected"].includes(fm.status.toLowerCase())) errors.push(`status '${fm.status}' harus draft | approved | rejected.`);
    if (fm.phase && !PHASES.includes(fm.phase.toLowerCase())) errors.push(`phase '${fm.phase}' harus salah satu dari ${PHASES.join(" | ")} (§2.2).`);
    const exp = FILE_PHASE[fileName];
    if (exp && fm.phase && fm.phase.toLowerCase() !== exp) errors.push(`${fileName} wajib ber-phase '${exp}', ditemukan '${fm.phase}' (§2.1).`);
  }
  const fmBatch = fm?.batch_id;
  const approved = (fm?.status || "").toLowerCase() === "approved";
  const phase = (fm?.phase || "").toLowerCase();

  if (fm?.source_file && SOURCE_FILE[phase] && fm.source_file !== SOURCE_FILE[phase])
    errors.push(`source_file untuk phase '${phase}' wajib '${SOURCE_FILE[phase]}', ditemukan '${fm.source_file}' (§2.2).`);

  // batch_id lintas file: creative-brief ↔ lp-sync, assets-ready ↔ creative-brief
  const upstream = { "creative-brief.md": "lp-sync.md", "assets-ready.md": "creative-brief.md" }[fileName];
  if (fmBatch && upstream && existsSync(join(dir, upstream))) {
    const u = readFm(join(dir, upstream));
    if (u?.batch_id && u.batch_id !== fmBatch) errors.push(`batch_id '${fmBatch}' berbeda dengan briefs/${upstream} ('${u.batch_id}') (§2.3).`);
  }

  // UTM
  const seen = new Set();
  for (const n of names) {
    const key = `${n.kind}:${n.value}:${n.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const e of validateName(n.kind, n.value, fmBatch))
      errors.push(`baris ${n.line}: ${n.kind === "content" ? "utm_content/ad_name" : "utm_" + n.kind} '${n.value}' — ${e}.`);
  }
  text.split(/\r?\n/).forEach((l, i) => {
    for (const url of l.match(/https?:\/\/[^\s)`'"<>|]+/g) || [])
      if (/[?&]utm_[a-z]+=/i.test(url)) errors.push(`baris ${i + 1}: URL berisi UTM hardcode (${url}). UTM wajib lewat url_tags saat launch (§3.2).`);
  });

  // policy
  const policy = loadPolicy();
  if (policy.loadError) warnings.push(policy.loadError);
  for (const { text: t, line, section } of policyLines) {
    const downgrade = phase === "landing-page" && !approved && /^audit\s+lp\s+saat\s+ini/i.test(section || "");
    scanPolicy(t, `baris ${line}`, errors, warnings, { downgrade });
  }

  // ── landing-page ──
  if (phase === "landing-page") {
    const lp = kvs.landing_page_url;
    if (!lp || !lp.value || PLACEHOLDER.test(lp.value)) errors.push("Deklarasi '- landing_page_url: `https://...`' tidak ditemukan di lp-sync (§2.4, §2.5).");
    else {
      if (!/^https?:\/\/\S+$/i.test(lp.value)) errors.push(`baris ${lp.line}: landing_page_url '${lp.value}' bukan URL http(s) yang valid.`);
      if (/utm_/i.test(lp.value)) errors.push(`baris ${lp.line}: landing_page_url mengandung 'utm_' (${lp.value}). Wajib URL bersih; UTM lewat url_tags Meta (§3.2, §5).`);
    }
    const promSec = Object.keys(sections).find((s) => /^janji\s+utama\s+lp/i.test(s));
    const promises = promSec ? sections[promSec].filter((l) => /^\s*([-*+]|\d+\.)\s+\S/.test(l)).length : 0;
    if (approved && promises < 2) errors.push(`'## Janji Utama LP' wajib berisi 2–4 janji (ditemukan ${promises}) sebelum approved (§2.4).`);
    if (promises > 4) warnings.push(`'## Janji Utama LP' berisi ${promises} janji; disarankan 2–4 agar message-match tajam.`);
    const px = kvs.meta_pixel_status;
    if (approved && !(px && PIXEL_ACTIVE.test(px.value)))
      errors.push(`status: approved tetapi meta_pixel_status bukan 'active' (${px ? `'${px.value}'` : "tidak ditemukan"}). Meta Pixel wajib aktif sebelum launch (§5).`);
    if (Object.keys(sections).some((s) => /^visual\s*&\s*palet/i.test(s)) && !/#[0-9a-f]{6}\b/i.test(Object.entries(sections).filter(([s]) => /^visual\s*&\s*palet/i.test(s)).map(([, l]) => l.join("\n")).join("\n")))
      warnings.push(`'## Visual & Palet' belum memuat warna hex (#RRGGBB); brief produksi membutuhkannya.`);
  }

  // ── creative-brief ──
  if (phase === "creative-brief") {
    const handoffDir = join(dir, "handoff");
    const handoffs = loadHandoff(handoffDir);
    for (const h of handoffs) if (h.parseError) errors.push(`handoff/${h.file}: JSON tidak valid (${h.parseError}).`);
    const ok = handoffs.filter((h) => h.data);
    const byId = new Map(ok.map((h) => [h.data.asset_id, h]));

    // ad_name yang dideklarasikan di brief (di luar "Konsep Tidak Dipilih")
    const declared = new Set();
    for (const n of names) if (n.kind === "content") {
      const sec = Object.entries(sections).find(([, ls]) => ls.some((l) => l.includes(n.value)))?.[0] || "";
      if (!/^konsep\s+tidak\s+dipilih/i.test(sec)) declared.add(n.value);
    }
    const lpIds = new Set((text.match(/b\d{6}(?:-\d+)?_lp-(?:hero|mockup)(?:-[a-z0-9]+)?_v\d+/g) || []));
    if (!declared.size) errors.push("Tidak ada ad_name yang dideklarasikan (format '- ad_name: `...`' atau kolom tabel ad_name).");
    for (const id of [...declared, ...lpIds]) if (!byId.has(id)) errors.push(`aset '${id}' belum punya spesifikasi briefs/handoff/${id}.json.`);
    for (const id of byId.keys()) if (!declared.has(id) && !lpIds.has(id)) errors.push(`briefs/handoff/${id}.json tidak tercantum di creative-brief.md.`);

    // blok Copy Meta per ad_name, identik dengan JSON
    for (const id of declared) {
      const key = Object.keys(subsections).find((s) => /^copy\s+meta/i.test(s) && s.includes(id));
      if (!key) { errors.push(`blok '### Copy Meta — ${id}' tidak ditemukan (Primary text, Headline, Description, CTA, URL siap copy-paste).`); continue; }
      const c = parseCopyBlock(subsections[key].lines);
      const at = `Copy Meta — ${id}`;
      for (const k of Object.keys(META_LIMITS)) {
        if (!c[k]) { errors.push(`${at}: '${k.replace("_", " ")}' kosong.`); continue; }
        if ([...c[k]].length > META_LIMITS[k]) errors.push(`${at}: ${k} ${[...c[k]].length} karakter; maksimal ${META_LIMITS[k]}.`);
      }
      if (!c.cta) errors.push(`${at}: 'CTA' kosong.`);
      if (!c.url) errors.push(`${at}: 'URL' kosong (pakai landing_page_url bersih dari lp-sync).`);
      else if (/utm_/i.test(c.url)) errors.push(`${at}: URL mengandung 'utm_'.`);
      const meta = byId.get(id)?.data?.copy?.meta;
      if (meta) for (const k of ["primary_text", "headline", "description", "cta"])
        if (c[k] && meta[k] && norm(c[k]) !== norm(meta[k])) errors.push(`${at}: ${k} berbeda dengan handoff/${id}.json — harus identik (yang di-copy-paste = yang di-launch).`);
    }

    for (const h of ok) {
      const r = checkHandoff(h.path, { siblingCheck: false });
      for (const e of r.errors) errors.push(`handoff/${h.file}: ${e}`);
      if (h.data.batch_id && fmBatch && h.data.batch_id !== fmBatch) errors.push(`handoff/${h.file}: batch_id '${h.data.batch_id}' ≠ '${fmBatch}'.`);
      if (approved && h.data.status !== "approved") errors.push(`handoff/${h.file}: status '${h.data.status}' — semua JSON wajib 'approved' saat brief approved.`);
    }
    batchChecks(dir, ok, fm, errors, warnings);

    const lpSync = join(dir, "lp-sync.md");
    if (approved && (!existsSync(lpSync) || (readFm(lpSync)?.status || "").toLowerCase() !== "approved"))
      errors.push("status: approved tetapi briefs/lp-sync.md belum approved (§2.3).");
  }

  // ── asset-intake ──
  if (phase === "asset-intake") {
    const manifest = tables.find((t) => t.headers.includes("asset_id") && t.headers.includes("file"));
    const handoffs = loadHandoff(join(dir, "handoff")).filter((h) => h.data);
    if (!manifest) errors.push("Tabel '## Manifest Aset' (kolom asset_id, recipient, file, ratio, size, duration, status) tidak ditemukan (§2.4).");
    else {
      const col = (n) => manifest.headers.indexOf(n);
      const rows = new Map(manifest.rows.map((r) => [r.cells[col("asset_id")], r]));
      for (const h of handoffs) if (!rows.has(h.data.asset_id)) errors.push(`aset '${h.data.asset_id}' dari brief belum ada di manifest.`);
      for (const [id, r] of rows) {
        const h = handoffs.find((x) => x.data.asset_id === id);
        if (!h) { errors.push(`baris ${r.line}: asset_id '${id}' tidak ada di briefs/handoff/.`); continue; }
        const st = (r.cells[col("status")] || "").toLowerCase();
        if (!["pending", "ready", "revise", "failed"].includes(st)) errors.push(`baris ${r.line}: status '${st}' harus pending | ready | revise | failed.`);
        const ratio = col("ratio") >= 0 ? r.cells[col("ratio")] : "";
        const want = h.data.deliverables?.map((x) => x.ratio) || [];
        if (ratio && !PLACEHOLDER.test(ratio) && want.length && !want.includes(ratio)) errors.push(`baris ${r.line}: rasio '${ratio}' tidak sesuai brief (${want.join(", ")}).`);
        const f = r.cells[col("file")] || "";
        if (f && !PLACEHOLDER.test(f) && !basename(f.split("?")[0]).startsWith(id)) errors.push(`baris ${r.line}: nama file '${basename(f)}' wajib diawali asset_id '${id}' (§4.3).`);
        if (approved && (st !== "ready" || !f || PLACEHOLDER.test(f))) errors.push(`baris ${r.line}: '${id}' belum ready/tanpa file, tidak bisa approved.`);
      }
    }
    const brief = join(dir, "creative-brief.md");
    if (approved && (!existsSync(brief) || (readFm(brief)?.status || "").toLowerCase() !== "approved"))
      errors.push("status: approved tetapi briefs/creative-brief.md belum approved.");
  }

  if (approved && ["landing-page", "creative-brief", "asset-intake"].includes(phase) && !hasQaPass(sections))
    errors.push("status: approved tetapi '## Hasil QA' tidak berisi 'Verdict batch: PASS' dari creative-qa (§2.3).");

  return { errors, warnings };
}

export function checkFile(file) {
  return file.toLowerCase().endsWith(".json") ? checkHandoff(file) : checkMarkdown(file);
}

function format(file, { errors, warnings }) {
  const out = [`[daekan-meta-ads quality gate] ${file}`];
  if (errors.length) out.push(`ERROR (${errors.length}) — wajib diperbaiki:`, ...errors.map((e) => `  ✗ ${e}`));
  if (warnings.length) out.push(`PERINGATAN (${warnings.length}) — cek bersama creative-qa:`, ...warnings.map((w) => `  ! ${w}`));
  if (!errors.length && !warnings.length) out.push("  ✓ Lolos: kontrak, UTM, copy Meta, anti-similarity, policy, dan spesifikasi handoff.");
  return out.join("\n");
}

function isBriefPath(p) {
  const n = p.split(sep).join("/");
  if (/\/archive\//i.test(n)) return false;
  if (/(^|\/)briefs\/handoff\/index\.json$/i.test(n)) return false;
  return /(^|\/)briefs\/[^/]+\.md$/i.test(n) || /(^|\/)briefs\/handoff\/[^/]+\.json$/i.test(n);
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length) {
    let failed = false;
    for (const a of args) {
      const f = resolve(a);
      if (!existsSync(f)) { console.error(`File tidak ditemukan: ${a}`); failed = true; continue; }
      const r = checkFile(f);
      console.log(format(a, r));
      if (r.errors.length) failed = true;
    }
    process.exit(failed ? 1 : 0);
  }

  let event;
  try { event = JSON.parse(await readStdin()); } catch { process.exit(0); }
  const input = event?.tool_input || {};
  const fp = input.file_path || input.path || input.notebook_path;
  if (!fp || !isBriefPath(fp)) process.exit(0);
  const file = isAbsolute(fp) ? fp : resolve(event.cwd || process.cwd(), fp);
  if (!existsSync(file)) process.exit(0);

  const r = checkFile(file);
  const report = format(fp, r);
  if (r.errors.length) {
    process.stderr.write(report + "\nPerbaiki error di atas sebelum melanjutkan fase berikutnya (ARCHITECTURE.md §6).\n");
    process.exit(2);
  }
  if (r.warnings.length)
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report } }));
  process.exit(0);
}

main();
