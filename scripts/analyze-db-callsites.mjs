// Ryva — Stage B cutover analyzer
//
// Produces a deterministic map of the SQLite -> Postgres query cutover:
//   * every db.prepare(...).get/all/run(...) call site (file:line),
//   * dialect-specific SQL that must be hand-translated for Postgres,
//   * db.transaction(...) usages that become `await store.tx(...)`.
//
// It does NOT rewrite code — the async cascade needs human/AI judgement per
// call chain. Run:  node scripts/analyze-db-callsites.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, "..", "server");

// SQL that behaves differently on Postgres and must be translated during cutover.
const DIALECT_PATTERNS = [
  { label: "INSERT OR REPLACE/IGNORE -> ON CONFLICT", re: /insert\s+or\s+(replace|ignore)/i },
  { label: "randomblob id -> gen_random_uuid()", re: /randomblob\s*\(/i },
  { label: "strftime/datetime('now') -> Postgres time fns", re: /strftime\s*\(|datetime\s*\(\s*'now'/i },
  { label: "PRAGMA (SQLite-only)", re: /\bpragma\s+\w/i },
  { label: "AUTOINCREMENT / rowid", re: /autoincrement|\browid\b/i },
  { label: "glob (SQLite-only operator)", re: /\bglob\b/i }
];

const CALL_RE = /\.prepare\s*\(/g;
const TERMINATOR_RE = /\.(get|all|run)\s*\(/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".mjs") && !entry.name.endsWith(".test.mjs")) out.push(full);
  }
  return out;
}

const files = walk(serverDir);
let totalPrepare = 0;
const terminatorCounts = { get: 0, all: 0, run: 0, unknown: 0 };
let transactionCount = 0;
const dialectHits = [];

for (const file of files) {
  const rel = path.relative(path.join(__dirname, ".."), file);
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");

  // Count prepare() sites and classify the terminator within the next ~12 lines.
  for (let i = 0; i < lines.length; i++) {
    if (/\.prepare\s*\(/.test(lines[i])) {
      totalPrepare += 1;
      const window = lines.slice(i, i + 12).join("\n");
      const match = window.match(TERMINATOR_RE);
      if (match) terminatorCounts[match[1]] += 1;
      else terminatorCounts.unknown += 1;
    }
    if (/db\.transaction\s*\(/.test(lines[i])) transactionCount += 1;
    for (const { label, re } of DIALECT_PATTERNS) {
      if (re.test(lines[i])) dialectHits.push({ file: rel, line: i + 1, label, text: lines[i].trim().slice(0, 100) });
    }
  }
}

console.log("=== Ryva Stage B cutover map ===\n");
console.log(`Files scanned: ${files.length}`);
console.log(`prepare() call sites: ${totalPrepare}`);
console.log(`  -> .queryOne (was .get): ${terminatorCounts.get}`);
console.log(`  -> .query    (was .all): ${terminatorCounts.all}`);
console.log(`  -> .execute  (was .run): ${terminatorCounts.run}`);
if (terminatorCounts.unknown) console.log(`  -> UNCLASSIFIED (inspect by hand): ${terminatorCounts.unknown}`);
console.log(`db.transaction(...) blocks -> await store.tx(...): ${transactionCount}\n`);

console.log(`Dialect-specific SQL to hand-translate: ${dialectHits.length}`);
for (const hit of dialectHits) {
  console.log(`  ${hit.file}:${hit.line}  [${hit.label}]`);
  console.log(`      ${hit.text}`);
}

console.log("\nRewrite key:");
console.log("  db.prepare(SQL).get(A)  ->  await store.queryOne(SQL, A)");
console.log("  db.prepare(SQL).all(A)  ->  await store.query(SQL, A)");
console.log("  db.prepare(SQL).run(A)  ->  await store.execute(SQL, A)");
console.log("  ...then mark the enclosing function async and await up the call chain.");
