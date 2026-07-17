#!/usr/bin/env node
/**
 * Vacademy RTL codemod — physical→logical Tailwind utility rewriter.
 *
 * Rewrites physical-direction Tailwind utilities to their logical-property
 * equivalents inside string literals of .ts/.tsx files, so that flipping
 * dir="rtl" later mirrors layout for free. In LTR documents the logical
 * utilities render identically (Tailwind 3.3+), so running this is
 * behaviorally invisible today.
 *
 * What it rewrites (whole class tokens only, incl. variant prefixes like
 * sm:/hover:/data-[state=open]:, negative -ml-4 and important !ml-4 forms,
 * and arbitrary values ml-[7px]):
 *
 *   ml- mr- pl- pr-          → ms- me- ps- pe-
 *   text-left, text-right    → text-start, text-end
 *   left-* right-* (inset)   → start-* end-*      (only whole inset tokens:
 *                                                  left-0, -left-2, left-1/2,
 *                                                  left-[10px], left-px|auto|full)
 *   border-l(-x), border-r(-x)   → border-s(-x), border-e(-x)
 *   rounded-l(-x), rounded-r(-x) → rounded-s(-x), rounded-e(-x)
 *   rounded-tl/tr/bl/br(-x)      → rounded-ss/se/es/ee(-x)
 *
 * What it deliberately SKIPS and flags for manual review (no safe 1:1 map,
 * or already correct):
 *
 *   space-x-* / divide-x-*   — need rtl:space-x-reverse or gap-x-* refactor
 *   translate-x-*            — sign flips in RTL; needs human judgment
 *   ms-/me-/ps-/pe-/start-/end-/… — already logical (keeps reruns idempotent)
 *   rtl:/ltr:-prefixed tokens — deliberate per-direction overrides
 *   tokens touching a `${…}` boundary — can't prove the full token
 *
 * Strings are found with a lightweight lexer (comments, '…'/"…" strings,
 * template literals with ${…} nesting, regex literals). Only whitespace-
 * delimited whole tokens inside string content are ever rewritten, so a
 * mis-lexed region cannot corrupt code.
 *
 * Usage:
 *   node scripts/rtl-codemod.mjs <dir> [--dry-run] [--report <path.json>]
 *
 * Prints a per-mapping summary and writes a JSON report (converted + flagged,
 * each with file:line) to --report (default ./rtl-codemod-report.json).
 * Idempotent: a second run over converted files changes nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dir: null, dryRun: false, report: path.resolve(process.cwd(), 'rtl-codemod-report.json') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--report') args.report = path.resolve(argv[++i] ?? args.report);
    else if (!a.startsWith('-') && !args.dir) args.dir = path.resolve(a);
    else {
      console.error(`rtl-codemod: unknown argument "${a}"`);
      process.exit(1);
    }
  }
  if (!args.dir) {
    console.error('Usage: node scripts/rtl-codemod.mjs <dir> [--dry-run] [--report <path.json>]');
    process.exit(1);
  }
  return args;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'android', 'ios', 'electron', '.git', 'coverage']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      yield path.join(dir, entry.name);
    }
  }
}

// ---------------------------------------------------------------------------
// Lexer: find string-literal content regions.
// Region = { start, end, hardOpen, hardClose } (start/end are content bounds;
// hardOpen/hardClose false when the boundary is a ${…} interpolation, i.e.
// the first/last token may be truncated).
// ---------------------------------------------------------------------------

// Chars after which a `/` starts a regex literal, not division. `<`/`>` are
// deliberately absent so `</div>` in JSX never opens a phantom regex; the
// `=>` arrow is special-cased below.
const REGEX_PRECEDERS = new Set([...'=(:,;![&|?{}+*-%~^']);
const REGEX_PRECEDER_WORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await', 'instanceof',
]);

function scanQuoteString(src, start, allowMultiline) {
  const quote = src[start];
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === quote) return i + 1; // index just past the closing quote
    if (c === '\n' && !allowMultiline) return -1; // lone apostrophe in JSX text, not a string
  }
  return -1;
}

function scanRegexLiteral(src, start) {
  let inClass = false;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === '\n') return -1; // not a regex after all
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      i++;
      while (i < src.length && /[a-z]/i.test(src[i])) i++; // flags
      return i;
    }
  }
  return -1;
}

/** True when `/` at src[i] starts a regex literal (heuristic look-behind). */
function slashStartsRegex(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const pc = src[j];
  if (pc === '>' && src[j - 1] === '=') return true; // `=> /re/`
  if (REGEX_PRECEDERS.has(pc)) return true;
  if (/[A-Za-z0-9_$]/.test(pc)) {
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(src[k])) k--;
    return REGEX_PRECEDER_WORDS.has(src.slice(k + 1, j + 1));
  }
  return false;
}

function lexStringRegions(src) {
  const regions = [];
  // Stack entries: { type: 'tpl' } while inside a template literal chunk,
  // { type: 'interp', depth } while inside a ${…} expression.
  const stack = [];
  let i = 0;
  let chunkStart = -1; // content start of the current template chunk
  let chunkHardOpen = true;

  const inTemplateChunk = () => stack.length > 0 && stack[stack.length - 1].type === 'tpl';

  while (i < src.length) {
    const c = src[i];

    if (inTemplateChunk()) {
      if (c === '\\') { i += 2; continue; }
      if (c === '`') {
        regions.push({ start: chunkStart, end: i, hardOpen: chunkHardOpen, hardClose: true });
        stack.pop();
        i++;
        continue;
      }
      if (c === '$' && src[i + 1] === '{') {
        regions.push({ start: chunkStart, end: i, hardOpen: chunkHardOpen, hardClose: false });
        stack.push({ type: 'interp', depth: 0 });
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // --- code mode (top-level, or inside a ${…} interpolation) ---
    if (c === '/') {
      const next = src[i + 1];
      if (next === '/') {
        const nl = src.indexOf('\n', i);
        i = nl === -1 ? src.length : nl;
        continue;
      }
      if (next === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 2;
        continue;
      }
      if (slashStartsRegex(src, i)) {
        const end = scanRegexLiteral(src, i);
        if (end !== -1) { i = end; continue; }
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      // JSX attribute strings (className="… may span lines…") are legal
      // multi-line strings; only allow that in `=`-preceded position so a
      // lone apostrophe in JSX text never swallows the rest of the file.
      let j = i - 1;
      while (j >= 0 && /\s/.test(src[j])) j--;
      const end = scanQuoteString(src, i, j >= 0 && src[j] === '=');
      if (end !== -1) {
        regions.push({ start: i + 1, end: end - 1, hardOpen: true, hardClose: true });
        i = end;
      } else {
        i++; // lone apostrophe/quote (JSX text) — not a string
      }
      continue;
    }
    if (c === '`') {
      stack.push({ type: 'tpl' });
      chunkStart = i + 1;
      chunkHardOpen = true;
      i++;
      continue;
    }
    if (stack.length > 0) {
      const top = stack[stack.length - 1]; // type === 'interp'
      if (c === '{') top.depth++;
      else if (c === '}') {
        if (top.depth === 0) {
          stack.pop(); // back into the enclosing template chunk
          chunkStart = i + 1;
          chunkHardOpen = false;
          i++;
          continue;
        }
        top.depth--;
      }
    }
    i++;
  }
  return regions;
}

// ---------------------------------------------------------------------------
// Token rewriting
// ---------------------------------------------------------------------------

// Ordered 1:1 mappings, applied to the utility segment (variants, `!` and the
// negative `-` already stripped). Each returns the new utility or null.
const MAPPINGS = [
  {
    key: (m) => `${m[1]}${m[2]}-→${m[1]}${m[2] === 'l' ? 's' : 'e'}-`,
    re: /^([mp])([lr])-(.+)$/,
    to: (m) => `${m[1]}${m[2] === 'l' ? 's' : 'e'}-${m[3]}`,
  },
  {
    key: () => 'text-left→text-start',
    re: /^text-left$/,
    to: () => 'text-start',
  },
  {
    key: () => 'text-right→text-end',
    re: /^text-right$/,
    to: () => 'text-end',
  },
  {
    // Inset only as whole utility tokens with a recognised value — never
    // inside longer words (left-sidebar, margin-left:, …).
    key: (m) => (m[1] === 'left' ? 'left-→start-' : 'right-→end-'),
    re: /^(left|right)-(\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|\[[^\]]+\])$/,
    to: (m) => `${m[1] === 'left' ? 'start' : 'end'}-${m[2]}`,
  },
  {
    key: (m) => (m[1] === 'l' ? 'border-l→border-s' : 'border-r→border-e'),
    re: /^border-([lr])(-.*)?$/,
    to: (m) => `border-${m[1] === 'l' ? 's' : 'e'}${m[2] ?? ''}`,
  },
  {
    key: (m) => `rounded-${m[1]}→rounded-${ROUNDED_MAP[m[1]]}`,
    re: /^rounded-(tl|tr|bl|br|l|r)(-.*)?$/,
    to: (m) => `rounded-${ROUNDED_MAP[m[1]]}${m[2] ?? ''}`,
  },
];
const ROUNDED_MAP = { l: 's', r: 'e', tl: 'ss', tr: 'se', bl: 'es', br: 'ee' };

// Skip categories (checked before mapping). Order matters only for reporting.
const SKIP_RULES = [
  { flag: 'space-x', re: /^space-x(?:$|-)/ },
  { flag: 'divide-x', re: /^divide-x(?:$|-)/ },
  { flag: 'translate-x', re: /^translate-x(?:$|-)/ },
  {
    flag: 'already-logical',
    re: /^(?:(?:ms|me|ps|pe)-|(?:start|end)-|text-(?:start|end)$|border-[se](?:$|-)|rounded-(?:ss|se|es|ee|s|e)(?:$|-))/,
  },
];

// Loose hint used only to flag physical-looking tokens truncated by `${…}`.
const PHYSICAL_HINT =
  /(?:^|:|!|-)(?:m[lr]-|p[lr]-|text-left|text-right|left-|right-|border-[lr](?:$|-)|rounded-(?:tl|tr|bl|br|l|r)(?:$|-)|space-x|divide-x|translate-x)/;

/** Split "sm:hover:-ml-4" → { variants: "sm:hover:", util: "-ml-4" } (last `:` outside […]). */
function splitVariants(token) {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (c === ':' && depth === 0) lastColon = i;
  }
  return lastColon === -1
    ? { variants: '', util: token }
    : { variants: token.slice(0, lastColon + 1), util: token.slice(lastColon + 1) };
}

/**
 * Process one whole class-ish token. Returns:
 *   { kind: 'convert', to, mapKey } | { kind: 'flag', flag } | null (untouched)
 */
function processToken(token) {
  const { variants, util } = splitVariants(token);
  if (/(^|:)(rtl|ltr):/.test(variants)) {
    return { kind: 'flag', flag: 'rtl-ltr-prefixed' };
  }

  let core = util;
  let bang = '';
  let neg = '';
  if (core.startsWith('!')) { bang = '!'; core = core.slice(1); }
  if (core.startsWith('-')) { neg = '-'; core = core.slice(1); }
  if (core === '') return null;

  for (const rule of SKIP_RULES) {
    if (rule.re.test(core)) return { kind: 'flag', flag: rule.flag };
  }
  for (const mapping of MAPPINGS) {
    const m = core.match(mapping.re);
    if (m) return { kind: 'convert', to: `${variants}${bang}${neg}${mapping.to(m)}`, mapKey: mapping.key(m) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-file driver
// ---------------------------------------------------------------------------

function lineOffsets(src) {
  const offsets = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') offsets.push(i + 1);
  return offsets;
}

function lineAt(offsets, pos) {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function processFile(file, relFile, stats) {
  const src = fs.readFileSync(file, 'utf8');
  const regions = lexStringRegions(src);
  if (regions.length === 0) return null;

  const offsets = lineOffsets(src);
  // Edits collected as { start, end, text } over the original source.
  const edits = [];

  for (const region of regions) {
    const content = src.slice(region.start, region.end);
    if (!/\S/.test(content)) continue;
    const tokenRe = /\S+/g;
    let m;
    while ((m = tokenRe.exec(content)) !== null) {
      const token = m[0];
      const absStart = region.start + m.index;
      const line = lineAt(offsets, absStart);
      const touchesOpen = !region.hardOpen && m.index === 0;
      const touchesClose = !region.hardClose && m.index + token.length === content.length;

      if (touchesOpen || touchesClose) {
        if (PHYSICAL_HINT.test(token)) {
          stats.flagged['interpolation-boundary'].push({ file: relFile, line, token });
        }
        continue;
      }

      const result = processToken(token);
      if (!result) continue;
      if (result.kind === 'flag') {
        stats.flagged[result.flag].push({ file: relFile, line, token });
        continue;
      }
      stats.conversions[result.mapKey] = (stats.conversions[result.mapKey] ?? 0) + 1;
      stats.converted.push({ file: relFile, line, from: token, to: result.to });
      edits.push({ start: absStart, end: absStart + token.length, text: result.to });
    }
  }

  if (edits.length === 0) return null;
  let out = '';
  let cursor = 0;
  for (const edit of edits) {
    out += src.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  out += src.slice(cursor);
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Exported for tests/debugging; main() only runs when executed directly.
export { lexStringRegions, processToken, splitVariants };

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir) || !fs.statSync(args.dir).isDirectory()) {
    console.error(`rtl-codemod: not a directory: ${args.dir}`);
    process.exit(1);
  }

  const stats = {
    conversions: {},
    converted: [],
    flagged: {
      'space-x': [],
      'divide-x': [],
      'translate-x': [],
      'already-logical': [],
      'rtl-ltr-prefixed': [],
      'interpolation-boundary': [],
    },
  };

  let filesScanned = 0;
  const filesChanged = [];
  for (const file of walk(args.dir)) {
    filesScanned++;
    const relFile = path.relative(args.dir, file);
    const rewritten = processFile(file, relFile, stats);
    if (rewritten !== null) {
      filesChanged.push(relFile);
      if (!args.dryRun) fs.writeFileSync(file, rewritten);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    root: args.dir,
    dryRun: args.dryRun,
    filesScanned,
    filesChanged: filesChanged.length,
    conversionCounts: stats.conversions,
    converted: stats.converted,
    flagged: stats.flagged,
  };
  fs.writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n');

  const totalConverted = stats.converted.length;
  console.log(`rtl-codemod ${args.dryRun ? '(dry-run) ' : ''}— ${args.dir}`);
  console.log(`  files scanned: ${filesScanned}, files ${args.dryRun ? 'that would change' : 'changed'}: ${filesChanged.length}`);
  console.log(`  tokens converted: ${totalConverted}`);
  for (const [key, count] of Object.entries(stats.conversions).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key}: ${count}`);
  }
  console.log('  flagged for manual review (NOT rewritten):');
  for (const [flag, entries] of Object.entries(stats.flagged)) {
    if (entries.length > 0) console.log(`    ${flag}: ${entries.length}`);
  }
  console.log(`  JSON report written to: ${args.report}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
