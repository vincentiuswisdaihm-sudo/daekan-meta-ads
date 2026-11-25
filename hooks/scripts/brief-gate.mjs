#!/usr/bin/env node
// Quality gate untuk file kontrak di briefs/ (lihat ARCHITECTURE.md §2, §3, §4, §6).
//
// Dua mode:
//   1. Hook PostToolUse (stdin = JSON event Claude Code). Hanya memeriksa
//      briefs/*.md (bukan briefs/archive/). Error -> exit 2 + stderr (umpan balik
//      ke Claude); hanya peringatan -> exit 0 + additionalContext.
//   2. CLI: node brief-gate.mjs <file.md> [...]. Exit 1 jika ada error.
//
// Tanpa dependensi eksternal (Node >= 18).

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, isAbsolute, join, sep } from "node:path";
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
const KEY_KIND = {
  utm_campaign: "campaign",
  utm_term: "term",
  utm_content: "content",
  ad_name: "content",
};
const REQUIRED_FM = ["batch_id", "phase", "status", "generated_at", "generated_by", "source_file"];
const MAX_DAEKAN_IMAGES = 4;

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
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.map((c) => c.trim());
}

function analyse(text) {
  const lines = text.split(/\r?\n/);
  const { fm, bodyStart } = parseFrontMatter(text);
  const names = []; // {kind, value, line}
  const tables = []; // {headers, rows:[{cells,line}], section}
  const policyLines = []; // {text, line}
  const sections = {}; // heading -> [lines]
  let section = "";
  let inFence = false;

  for (let i = bodyStart; i < lines.length; i++) {
    const raw = lines[i];
    const ln = i + 1;
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h2 = raw.match(/^##\s+(.+?)\s*$/);
    if (h2) { section = h2[1].trim(); sections[section] = []; continue; }
    if (section) sections[section].push(raw);

    // Tabel markdown
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
      // baris tabel tetap discan policy di bawah
    }

    // Deklarasi key-value: "- ad_name: `...`" / "**utm_term:** `...`"
    const kv = raw.match(/^\s*(?:[-*+]\s+)?\**`?(utm_campaign|utm_term|utm_content|ad_name)`?\**\s*:\s*\**\s*(?:`([^`]+)`|([^\s|*]+))/i);
    if (kv) {
      const v = (kv[2] ?? kv[3] ?? "").trim();
      if (v && !PLACEHOLDER.test(v) && !/[{<]/.test(v)) names.push({ kind: KEY_KIND[kv[1].toLowerCase()], value: v, line: ln });
    }

    // Kandidat scan policy (bukan section QA, bukan negative prompt, bukan qa-ignore)
    const isQA = /^hasil\s+qa/i.test(section);
    const isNegative = /^\s*(?:[-*+]\s+)?\**(negative(\s+prompt)?|negatif)\**\s*:/i.test(raw);
    if (!isQA && !isNegative && !/qa-ignore/i.test(raw)) policyLines.push({ text: raw, line: ln });
  }
  return { fm, names, tables, policyLines, sections };
}

function loadPolicy() {
  try {
    const p = JSON.parse(readFileSync(POLICY_FILE, "utf8"));
    const compile = (arr) => (arr || []).map((t) => ({ re: new RegExp(t.pattern, "i"), reason: t.reason }));
    return { high: compile(p.high), medium: compile(p.medium) };
  } catch (e) {
    return { high: [], medium: [], loadError: `Gagal membaca ${POLICY_FILE}: ${e.message}` };
  }
}

// ── Pemeriksaan utama ─────────────────────────────────────────────────────
export function checkFile(file) {
  const errors = [];
  const warnings = [];
  const text = readFileSync(file, "utf8");
  const { fm, names, tables, policyLines, sections } = analyse(text);

  // 1. Front-matter kontrak
  if (!fm) {
    errors.push("Front-matter YAML (--- ... ---) tidak ditemukan (ARCHITECTURE.md §2.2).");
  } else {
    const missing = REQUIRED_FM.filter((k) => !(k in fm) || fm[k] === "");
    if (missing.length) errors.push(`Front-matter kurang field: ${missing.join(", ")} (ARCHITECTURE.md §2.2).`);
    if (fm.batch_id && !/^b\d{6}(-\d+)?$/.test(fm.batch_id)) errors.push(`batch_id '${fm.batch_id}' harus bYYMMDD (opsional -n).`);
    if (fm.status && !["draft", "approved", "rejected"].includes(fm.status.toLowerCase()))
      errors.push(`status '${fm.status}' harus draft | approved | rejected.`);
  }
  const fmBatch = fm?.batch_id;
  const approved = (fm?.status || "").toLowerCase() === "approved";

  // 2. Format UTM
  const seen = new Set();
  for (const n of names) {
    const key = `${n.kind}:${n.value}:${n.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const e of validateName(n.kind, n.value, fmBatch)) {
      errors.push(`baris ${n.line}: ${n.kind === "content" ? "utm_content/ad_name" : "utm_" + n.kind} '${n.value}' — ${e}.`);
    }
  }

  // 3. UTM tidak boleh di-hardcode di URL landing page (§3.2, §3.6)
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const url of l.match(/https?:\/\/[^\s)`'"<>|]+/g) || []) {
      if (/[?&]utm_[a-z]+=/i.test(url)) errors.push(`baris ${i + 1}: URL berisi UTM hardcode (${url}). UTM wajib lewat url_tags saat launch (§3.2).`);
    }
  });

  // 4. Kata rawan Meta Policy
  const policy = loadPolicy();
  if (policy.loadError) warnings.push(policy.loadError);
  for (const { text: t, line } of policyLines) {
    for (const { re, reason } of policy.high) {
      const m = t.match(re);
      if (m) errors.push(`baris ${line}: frasa rawan policy "${m[0]}" — ${reason}.`);
    }
    for (const { re, reason } of policy.medium) {
      const m = t.match(re);
      if (m) warnings.push(`baris ${line}: frasa perlu dicek "${m[0]}" — ${reason}.`);
    }
  }

  // 5. Aturan dual-engine & gate status
  const phase = (fm?.phase || "").toLowerCase();
  if (phase === "strategy") {
    const promptSec = Object.keys(sections).find((s) => /^prompt\s+visual\s+daekan/i.test(s));
    if (!promptSec) {
      errors.push("Section '## Prompt Visual Daekan' tidak ditemukan (ARCHITECTURE.md §2.4).");
    } else {
      const count = sections[promptSec].filter((l) => /^###\s+/.test(l)).length;
      if (count > MAX_DAEKAN_IMAGES) errors.push(`Prompt gambar Daekan = ${count}; maksimal ${MAX_DAEKAN_IMAGES} per batch (§4.1). Satu prompt = satu heading '### '.`);
    }
  }
  if (phase === "production") {
    const manifest = tables.find((t) => t.headers.includes("ad_name") && t.headers.includes("engine"));
    if (!manifest) {
      errors.push("Tabel '## Manifest Aset' (kolom ad_name, engine, daekan_asset_url, render_path, ...) tidak ditemukan (§2.4).");
    } else {
      const col = (n) => manifest.headers.indexOf(n);
      const iEng = col("engine"), iUrl = col("daekan_asset_url"), iPath = col("render_path");
      let daekanRows = 0;
      for (const r of manifest.rows) {
        const eng = (r.cells[iEng] || "").toLowerCase();
        if (eng && !["daekan", "remotion"].includes(eng)) errors.push(`baris ${r.line}: engine '${eng}' tidak diizinkan; hanya daekan | remotion (§4).`);
        if (eng === "daekan") daekanRows++;
        if (approved && eng === "daekan" && !/^https?:\/\//.test(r.cells[iUrl] || "")) errors.push(`baris ${r.line}: aset Daekan tanpa daekan_asset_url (§4.1).`);
        if (approved && eng === "remotion") {
          if (!(r.cells[iPath] || "").match(/\.(mp4|mov|webm)$/i)) errors.push(`baris ${r.line}: video Remotion tanpa render_path .mp4/.mov/.webm (§4.2).`);
          if (iUrl >= 0 && !/^https?:\/\//.test(r.cells[iUrl] || "")) errors.push(`baris ${r.line}: video Remotion wajib mencatat URL aset Daekan yang dipakai di daekan_asset_url (§4.2).`);
        }
      }
      if (daekanRows > MAX_DAEKAN_IMAGES) errors.push(`Gambar Daekan di manifest = ${daekanRows}; maksimal ${MAX_DAEKAN_IMAGES} per batch (§4.1).`);
    }
    const assets = tables.find((t) => t.headers.includes("prompt") && t.headers.includes("daekan_asset_url"));
    if (!assets) {
      errors.push("Tabel '## Aset Daekan' (kolom prompt, daekan_asset_url, rasio, dipakai_oleh) tidak ditemukan (§2.4).");
    } else {
      const iUrl = assets.headers.indexOf("daekan_asset_url");
      if (assets.rows.length > MAX_DAEKAN_IMAGES) errors.push(`Aset Daekan = ${assets.rows.length} gambar; maksimal ${MAX_DAEKAN_IMAGES} per batch (§4.1).`);
      if (approved) for (const r of assets.rows) {
        if (!/^https?:\/\//.test(r.cells[iUrl] || "")) errors.push(`baris ${r.line}: aset Daekan tanpa daekan_asset_url (§4.1).`);
      }
    }
  }
  if (approved && (phase === "strategy" || phase === "production")) {
    const qaSec = Object.keys(sections).find((s) => /^hasil\s+qa/i.test(s));
    const qaText = qaSec ? sections[qaSec].join("\n") : "";
    if (!/verdict\s+batch\s*:?\**\s*:?\s*\**\s*PASS\b(?![ \t]*\|)/i.test(qaText))
      errors.push("status: approved tetapi '## Hasil QA' tidak berisi 'Verdict batch: PASS' dari creative-qa (§2.3).");
  }

  return { errors, warnings };
}

function format(file, { errors, warnings }) {
  const out = [`[daekan-meta-ads quality gate] ${file}`];
  if (errors.length) out.push(`ERROR (${errors.length}) — wajib diperbaiki:`, ...errors.map((e) => `  ✗ ${e}`));
  if (warnings.length) out.push(`PERINGATAN (${warnings.length}) — cek bersama creative-qa:`, ...warnings.map((w) => `  ! ${w}`));
  if (!errors.length && !warnings.length) out.push("  ✓ Lolos: front-matter, format UTM, kata rawan policy, aturan dual-engine.");
  return out.join("\n");
}

// ── Entry point ───────────────────────────────────────────────────────────
function isBriefPath(p) {
  const norm = p.split(sep).join("/");
  return /(^|\/)briefs\/[^/]+\.md$/i.test(norm) && !/\/archive\//i.test(norm);
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
  if (r.warnings.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report },
    }));
  }
  process.exit(0);
}

main();
