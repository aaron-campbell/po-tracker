#!/usr/bin/env node
/**
 * Import PO data from the Horizon56 Slack purchase-order channel.
 * Usage: node scripts/import-slack-pos.mjs
 *
 * Fetches all messages, parses PO fields, previews what will be imported,
 * then prompts for confirmation before writing to the database.
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
  const envFile = readFileSync(resolve(__dirname, "../.env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* rely on env vars */ }

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SLACK_TOKEN = process.env.SLACK_TOKEN || "";
const CHANNEL_ID = "C09FW9EQ6GY";

// ── Slack API ──────────────────────────────────────────────────────────────

async function fetchAllMessages() {
  const messages = [];
  let cursor = undefined;

  do {
    const url = new URL("https://slack.com/api/conversations.history");
    url.searchParams.set("channel", CHANNEL_ID);
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
    });
    const data = await res.json();

    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
    messages.push(...data.messages);
    cursor = data.has_more ? data.response_metadata?.next_cursor : undefined;
  } while (cursor);

  return messages;
}

// ── Parsers ────────────────────────────────────────────────────────────────

function extractField(text, ...labels) {
  for (const label of labels) {
    const re = new RegExp(`${label}[:\\s]+([^\\n]+)`, "i");
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function parseCurrency(raw) {
  if (!raw) return null;
  // Strip currency symbols, labels, and trailing punctuation
  let s = raw.replace(/USD|NOK|EUR|GBP/gi, "").replace(/[$£€]/g, "").replace(/[.,\s]+$/, "").trim();

  // European format: digits with period as thousands separator (e.g. 250.975 or 168.000)
  // Detect: ends in exactly 3 decimal digits after a period, no comma
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else {
    // US format: remove commas
    s = s.replace(/,/g, "");
  }

  const val = parseFloat(s);
  return isNaN(val) ? null : val;
}

function parseDate(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/(\d+)(st|nd|rd|th)/g, "$1")
    .trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function normaliseRevenueType(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (/hypercare/.test(t)) return "Hypercare";
  if (/deployment/.test(t)) return "Deployment";
  if (/development/.test(t)) return "Development";
  if (/training/.test(t)) return "Training";
  if (/saas|subscription|software/.test(t)) return "SaaS";
  return "Other";
}

function inferRevenueType(text) {
  const t = text.toLowerCase();
  if (/hypercare/.test(t)) return "Hypercare";
  if (/deployment/.test(t)) return "Deployment";
  if (/development/.test(t)) return "Development";
  if (/training/.test(t)) return "Training";
  if (/saas|subscription|software fee|software service/.test(t)) return "SaaS";
  return null;
}

function extractPoNumber(text, files) {
  // 1. Explicit labeled field in text
  const labeled = extractField(text, "PO number", "PO#", "PO No", "Purchase Order Number");
  if (labeled) return labeled.split(/\s/)[0]; // stop at first space

  // 2. "Updated PO from X: NUMBER" or "see revised PO NUMBER"
  let m = text.match(/(?:updated\s+po\s+from\s+\w+|revised\s+po)[:\s]+([A-Z0-9\-]{5,})/i);
  if (m) return m[1];

  // 3. "PO NUMBER" standalone reference (8+ digit number after "PO ")
  m = text.match(/\bPO\s+([0-9]{7,})\b/);
  if (m) return m[1];

  // 4. Filename: starts with digits "300186528 Valiant.pdf"
  for (const f of files || []) {
    const name = f.name;
    // Starts with number
    let fm = name.match(/^(\d{6,})/);
    if (fm) return fm[1];
    // PO followed immediately by number: "PO4504594019 ..."
    fm = name.match(/^PO[_ -]?(\d{6,})/i);
    if (fm) return fm[1];
    // PO_ALPHA+NUM: "PO_BMA61401000421_..."
    fm = name.match(/PO[_-]([A-Z]{1,4}\d{6,})[_-]/i);
    if (fm) return fm[1];
    // PO-NNNN: "PO-4900069335_v1..."
    fm = name.match(/PO[-_](\d{7,})/i);
    if (fm) return fm[1];
    // "PO 4504196421 H56.pdf"
    fm = name.match(/^PO\s+(\d{6,})/i);
    if (fm) return fm[1];
  }

  return null;
}

function inferClientName(text) {
  const KNOWN = /^(BP|Equinor|Seadrill|Valaris|Noble|Transocean|SLB|Harbour|TotalEnergies|OMV)/i;

  // "New/Updated PO received from CLIENT:" — stop at known stopwords
  let m = text.match(/(?:new|updated)?\s*po\s+received\s+from\s+([\w&.\- ]+?)(?:\s+that\b|\s+for\b|[:\n]|$)/i);
  if (m && KNOWN.test(m[1].trim())) return m[1].trim();

  // "Purchase order from CLIENT"
  m = text.match(/purchase\s+order\s+from\s+([\w&.\- ]+?)(?:\s+for\b|[.\n]|$)/i);
  if (m && KNOWN.test(m[1].trim())) return m[1].trim();

  // "PO from CLIENT" / "Updated PO from CLIENT:"
  m = text.match(/\bpo\s+from\s+([\w&.\- ]+?)(?:\s+for\b|[.:\n]|$)/i);
  if (m && KNOWN.test(m[1].trim())) return m[1].trim();

  // Company name header on first line
  const firstLine = text.split("\n")[0].trim();
  if (KNOWN.test(firstLine)) return firstLine;

  return null;
}

function normaliseClientName(raw) {
  if (!raw) return null;
  const name = raw.trim();
  // Collapse known variants
  if (/^bp\b/i.test(name) || /^bp\s+exploration/i.test(name) || /^bp\s+trinidad/i.test(name)) return "bp";
  if (/^noble\b/i.test(name)) return "Noble";
  if (/^equinor/i.test(name)) return "Equinor";
  if (/^seadrill/i.test(name)) return "Seadrill";
  if (/^valaris/i.test(name)) return "Valaris";
  if (/^transocean/i.test(name)) return "Transocean";
  if (/^slb/i.test(name)) return "SLB";
  if (/^harbour/i.test(name)) return "Harbour Energy";
  if (/^total/i.test(name)) return "TotalEnergies";
  if (/^omv/i.test(name)) return "OMV";
  return name;
}

function parseMessage(msg) {
  const text = msg.text || "";
  const hasPdf = msg.files?.some((f) => f.filetype === "pdf");

  // Must have a PDF to be a real PO message
  if (!hasPdf) return null;

  // Skip messages that are clearly not PO submissions
  if (/quote|proposal|letter agreement|commitment/i.test(text) &&
      !/\bpo\b|\bpurchase order\b/i.test(text)) return null;

  const poNumber = extractPoNumber(text, msg.files);
  if (!poNumber) return null;

  const rawValue = extractField(text, "PO value", "PO Value", "value");
  const totalValue = parseCurrency(rawValue);
  if (!totalValue || totalValue <= 0) return null;

  const rawDate =
    extractField(text, "Date received", "Issue date", "Issue Date", "received") ||
    null;
  const orderDate = parseDate(rawDate) || new Date(parseInt(msg.ts) * 1000);

  const clientRaw = inferClientName(text);
  const clientName = normaliseClientName(clientRaw);
  if (!clientName) return null;

  const rawRevenueType =
    extractField(text, "Revenue Type") ||
    inferRevenueType(text);
  const revenueType = normaliseRevenueType(rawRevenueType);

  const rig = extractField(text, "Rig") || null;
  const notes = rig ? `Rig: ${rig}` : null;

  const pdfUrl = msg.files?.find((f) => f.filetype === "pdf")?.url_private || null;

  return {
    poNumber: poNumber.trim(),
    clientName,
    totalValue,
    orderDate,
    revenueType: revenueType ? revenueType.trim() : null,
    notes,
    pdfUrl,
    slackTs: msg.ts,
    rawText: text.substring(0, 200),
  };
}

// ── CLI helpers ────────────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function fmt(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function backfillPdfPaths(parsed, existingSet) {
  const candidates = parsed.filter((p) => existingSet.has(p.poNumber) && p.pdfUrl);
  if (candidates.length === 0) return;
  console.log(`\nBackfilling PDF URLs for ${candidates.length} existing POs...`);
  for (const p of candidates) {
    const record = await prisma.purchaseOrder.findUnique({ where: { poNumber: p.poNumber }, select: { id: true, pdfPath: true } });
    if (record && !record.pdfPath) {
      await prisma.purchaseOrder.update({ where: { id: record.id }, data: { pdfPath: p.pdfUrl } });
      console.log(`  ✓ ${p.poNumber}`);
    }
  }
}

async function main() {
  if (!SLACK_TOKEN) {
    console.error("Error: SLACK_TOKEN not set. Add it to your .env file.");
    process.exit(1);
  }

  console.log("Fetching messages from Slack...");
  const messages = await fetchAllMessages();
  console.log(`Fetched ${messages.length} messages.\n`);

  // Parse
  const parsed = messages.map(parseMessage).filter(Boolean);

  // De-duplicate by PO number (keep first occurrence = most recent Slack message)
  const seen = new Set();
  const unique = parsed.filter((p) => {
    if (seen.has(p.poNumber)) return false;
    seen.add(p.poNumber);
    return true;
  });

  if (unique.length === 0) {
    console.log("No parseable PO messages found.");
    process.exit(0);
  }

  // Check which already exist in DB
  const existing = await prisma.purchaseOrder.findMany({ select: { poNumber: true } });
  const existingSet = new Set(existing.map((p) => p.poNumber));

  const toImport = unique.filter((p) => !existingSet.has(p.poNumber));
  const skipped = unique.filter((p) => existingSet.has(p.poNumber));

  // Preview
  console.log("─────────────────────────────────────────────────────────");
  console.log(`Found ${unique.length} POs in Slack`);
  console.log(`  Already in DB (skip):  ${skipped.length}`);
  console.log(`  New (to import):       ${toImport.length}`);
  console.log("─────────────────────────────────────────────────────────\n");

  if (toImport.length === 0) {
    console.log("Nothing new to import.");
    await backfillPdfPaths(unique, existingSet);
    process.exit(0);
  }

  console.log("POs to be imported:\n");
  toImport.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.poNumber} | ${p.clientName.padEnd(20)} | ${fmt(p.totalValue).padStart(12)} | ${p.revenueType || "—"}`);
  });

  console.log();
  const answer = await ask(`Import ${toImport.length} POs? (yes/no): `);
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  // Import
  let created = 0;
  let errors = 0;

  for (const p of toImport) {
    try {
      // Upsert client
      let client = await prisma.client.findUnique({ where: { name: p.clientName } });
      if (!client) {
        client = await prisma.client.create({ data: { name: p.clientName } });
      }

      await prisma.purchaseOrder.create({
        data: {
          poNumber: p.poNumber,
          clientId: client.id,
          orderDate: p.orderDate,
          totalValue: p.totalValue,
          revenueType: p.revenueType,
          notes: p.notes,
          pdfPath: p.pdfUrl,
          status: "Open",
          currency: "USD",
        },
      });

      console.log(`  ✓ ${p.poNumber} — ${p.clientName}`);
      created++;
    } catch (e) {
      console.error(`  ✗ ${p.poNumber} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone. ${created} imported, ${errors} errors, ${skipped.length} skipped (already existed).`);
  await backfillPdfPaths(unique, existingSet);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
