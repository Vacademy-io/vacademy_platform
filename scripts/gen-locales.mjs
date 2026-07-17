#!/usr/bin/env node
/**
 * Vacademy locale mirror generator.
 *
 * Reads the canonical locale spec (locales.json at the monorepo root) and
 * regenerates each frontend app's src/i18n/locales.ts mirror so the apps can
 * never drift from the spec. The per-app RTL_READY flag (whether that app's
 * layout has been audited for right-to-left rendering) is app-owned state: if
 * the mirror already exists, its RTL_READY value is parsed and preserved;
 * otherwise it defaults to false.
 *
 * Usage:
 *   node scripts/gen-locales.mjs           # regenerate both app mirrors
 *   node scripts/gen-locales.mjs --check   # exit 2 if any mirror is stale (CI)
 *
 * Idempotent: running it twice in a row produces byte-identical output.
 * To change locales, edit locales.json — never the generated files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(REPO_ROOT, 'locales.json');

const APPS = ['frontend-admin-dashboard', 'frontend-learner-dashboard-app'];

function loadSpec() {
  const raw = fs.readFileSync(SPEC_PATH, 'utf8');
  const spec = JSON.parse(raw);
  for (const key of ['supported', 'default', 'rtl', 'nativeLabels', 'scripts']) {
    if (!(key in spec)) {
      throw new Error(`locales.json is missing required key "${key}"`);
    }
  }
  return spec;
}

/** Parse RTL_READY out of an existing mirror; default false when absent. */
function readExistingRtlReady(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const m = text.match(/RTL_READY\s*(?::\s*boolean\s*)?=\s*(true|false)/);
    if (m) return m[1] === 'true';
  } catch {
    /* file doesn't exist yet — first generation */
  }
  return false;
}

function quote(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function renderMirror(spec, rtlReady) {
  // Emits the EXACT shape both apps already import (SupportedLocale type,
  // isSupportedLocale/normalizeLocale helpers) — keep this template in
  // lock-step with any hand refinement of the mirrors.
  const lines = [];
  lines.push('/**');
  lines.push(' * Canonical locale spec for the platform (BCP-47 codes).');
  lines.push(' *');
  lines.push(' * This is the single source of truth for which UI languages exist, their');
  lines.push(' * native labels, scripts and text direction. Every locale-aware surface');
  lines.push(' * (i18n init, language dropdown, Settings > Language, Accept-Language header,');
  lines.push(' * Intl formatters) must import from here instead of redefining its own list.');
  lines.push(' *');
  lines.push(' * GENERATED from <monorepo root>/locales.json — regenerate with');
  lines.push(' * `node scripts/gen-locales.mjs`; only RTL_READY is app-owned (preserved');
  lines.push(' * across regeneration). The order of SUPPORTED_LOCALES is intentional');
  lines.push(' * (en first, then priority languages) and is used as picker display order.');
  lines.push(' */');
  lines.push('');
  lines.push('export const SUPPORTED_LOCALES = [');
  for (const code of spec.supported) lines.push(`    ${quote(code)},`);
  lines.push('] as const;');
  lines.push('');
  lines.push('export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];');
  lines.push('');
  lines.push(`export const DEFAULT_LOCALE: SupportedLocale = ${quote(spec.default)};`);
  lines.push('');
  lines.push('/** Locales rendered right-to-left. */');
  lines.push(
    `export const RTL_LOCALES: readonly SupportedLocale[] = [${spec.rtl.map(quote).join(', ')}];`
  );
  lines.push('');
  lines.push('/**');
  lines.push(" * HARD GATE for RTL layout. The document `dir` attribute stays 'ltr' for every");
  lines.push(' * locale (including Arabic) until the RTL codemod wave lands — flipping dir');
  lines.push(' * before the codebase is logical-property clean would break most screens.');
  lines.push(' * Flip to true only as part of that wave.');
  lines.push(' */');
  lines.push(`export const RTL_READY: boolean = ${rtlReady};`);
  lines.push('');
  lines.push('/** Native (endonym) display names — what users see in language pickers. */');
  lines.push('export const LOCALE_LABELS: Record<SupportedLocale, string> = {');
  for (const code of spec.supported) {
    lines.push(`    ${code}: ${quote(spec.nativeLabels[code] ?? code)},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('/** Writing script per locale (useful for font stacks / content pipelines). */');
  lines.push('export const LOCALE_SCRIPTS: Record<SupportedLocale, string> = {');
  for (const code of spec.supported) {
    lines.push(`    ${code}: ${quote(spec.scripts[code] ?? 'latin')},`);
  }
  lines.push('};');
  lines.push('');
  lines.push('export function isSupportedLocale(value: unknown): value is SupportedLocale {');
  lines.push('    return (');
  lines.push(
    '        typeof value === \'string\' && (SUPPORTED_LOCALES as readonly string[]).includes(value)'
  );
  lines.push('    );');
  lines.push('}');
  lines.push('');
  lines.push('/**');
  lines.push(' * Normalizes any language tag to a supported locale:');
  lines.push(" * 'en-US' → 'en', 'hi-IN' → 'hi', unknown/empty → DEFAULT_LOCALE.");
  lines.push(' */');
  lines.push('export function normalizeLocale(value: string | null | undefined): SupportedLocale {');
  lines.push('    if (!value || typeof value !== \'string\') return DEFAULT_LOCALE;');
  lines.push('    const trimmed = value.trim();');
  lines.push('    if (isSupportedLocale(trimmed)) return trimmed;');
  lines.push("    const base = trimmed.toLowerCase().split(/[-_]/)[0] ?? '';");
  lines.push('    return isSupportedLocale(base) ? base : DEFAULT_LOCALE;');
  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  let spec;
  try {
    spec = loadSpec();
  } catch (err) {
    console.error(`gen-locales: cannot load ${SPEC_PATH}: ${err.message}`);
    process.exit(1);
  }

  let stale = 0;
  for (const app of APPS) {
    const outDir = path.join(REPO_ROOT, app, 'src', 'i18n');
    const outFile = path.join(outDir, 'locales.ts');
    const rtlReady = readExistingRtlReady(outFile);
    const next = renderMirror(spec, rtlReady);

    let current = null;
    try {
      current = fs.readFileSync(outFile, 'utf8');
    } catch {
      /* mirror missing */
    }

    if (current === next) {
      console.log(`gen-locales: ${app}/src/i18n/locales.ts up to date ✓`);
      continue;
    }

    if (checkOnly) {
      console.error(`gen-locales: ${app}/src/i18n/locales.ts is stale (run node scripts/gen-locales.mjs)`);
      stale++;
      continue;
    }

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outFile, next, 'utf8');
    console.log(`gen-locales: wrote ${app}/src/i18n/locales.ts (RTL_READY=${rtlReady})`);
  }

  process.exit(stale > 0 ? 2 : 0);
}

main();
