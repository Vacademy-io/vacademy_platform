#!/usr/bin/env node
/**
 * Exports the catalogue page-builder component vocabulary as a JSON "schema
 * catalog" for the AI Page Builder (ai_service composer prompt).
 *
 * Single source of truth: the admin editor's component-templates.ts (every
 * component type + canonical props) and the shared style engine / decorations
 * vocabulary. Regenerate whenever templates or the engine change:
 *
 *   node scripts/export-catalogue-schema-catalog.mjs
 *
 * Output: ai_service/app/data/catalogue_schema_catalog.json
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADMIN = path.join(ROOT, 'frontend-admin-dashboard');
const OUT = path.join(ROOT, 'ai_service/app/data/catalogue_schema_catalog.json');

// pnpm nests esbuild under vite — resolve it through vite's own require.
const adminRequire = createRequire(path.join(ADMIN, 'package.json'));
const viteRequire = createRequire(adminRequire.resolve('vite/package.json'));
const esbuild = viteRequire('esbuild');

/** Bundle a TS/TSX module from the admin app and import it. */
async function importTs(relPath) {
    // Emit inside the admin app so bare imports (react) resolve at import time
    const outfile = path.join(ADMIN, `.tmp-schema-export-${path.basename(relPath).replace(/\W/g, '_')}.mjs`);
    await esbuild.build({
        entryPoints: [path.join(ADMIN, relPath)],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile,
        jsx: 'transform',
        external: ['react'],
        logLevel: 'silent',
    });
    const mod = await import(`${outfile}?t=${Date.now()}`);
    fs.unlinkSync(outfile);
    return mod;
}

const { componentTemplates } = await importTs('src/routes/manage-pages/-utils/component-templates.ts');
const { ORNAMENT_PRESETS } = await importTs('src/routes/manage-pages/-utils/catalogue-decorations.tsx');

/* ─── Which component types the AI may emit ────────────────────────────── */

// Data-bound / structural / risky types the composer must NOT invent content
// for. Data components (courseCatalog etc.) ARE allowed — they render live
// institute data — but get a special note. htmlBlock is forbidden entirely.
const FORBIDDEN = new Set(['htmlBlock']);
const DATA_BOUND = {
    courseCatalog: 'Renders the institute\'s LIVE course grid. Configure filters/title only — never invent course entries.',
    bookCatalogue: 'Renders the LIVE book store. Configure presentation only.',
    cartComponent: 'Live cart. Placement only.',
    courseDetails: 'Live single-course detail context. Only on course sub-pages.',
    bookDetails: 'Live single-book detail context.',
    buyRentSection: 'Live buy/rent controls.',
    policyRenderer: 'Renders stored policy documents. Placement only.',
};

// Collapse the columnLayout template variants into one canonical entry.
const LAYOUT_ALIASES = new Set(['columnLayout2asymLeft', 'columnLayout3', 'columnLayout4']);

const components = [];
for (const [key, tpl] of Object.entries(componentTemplates)) {
    if (FORBIDDEN.has(tpl.type) || LAYOUT_ALIASES.has(key)) continue;
    components.push({
        type: tpl.type,
        templateKey: key,
        exampleProps: tpl.props,
        ...(DATA_BOUND[tpl.type] ? { dataBound: DATA_BOUND[tpl.type] } : {}),
    });
}

/* ─── ComponentStyle vocabulary (kept in prose — the engine is the schema) ── */

const styleSchema = {
    description:
        'Every component may carry an optional "style" object (ComponentStyle). All fields optional; omit for defaults. Use PRESETS over raw values.',
    fields: {
        padding_margin: 'paddingTop/Bottom/Left/Right, marginTop/Bottom — CSS lengths like "48px".',
        background:
            'backgroundColor (hex), backgroundImage (URL from provided media only), backgroundSize, backgroundPosition, overlayPreset: scrim-dark|scrim-bottom|scrim-light|brand-tint (legible text over images).',
        backgroundLayers:
            'Array of composed layers [{type: linear|radial|color, from,to,angle | color,posX,posY,size}]. Radial size must be a percentage like "60%". Use for mesh/glow backdrops.',
        effects:
            'glass:{blur:sm|md|lg}, glow:{intensity:sm|md|lg}, borderGradient:{from,to,angle,width}, boxShadow: sm|md|lg|xl|2xl.',
        ornaments:
            'Ambient decorative shapes behind content. STRONGLY prefer the preset arrays below (copy one verbatim into style.ornaments).',
        dividers:
            'Shaped section edges: {top?:{shape:wave|angle|curve,height?,flip?}, bottom?:{...}}. Cut in the page background color.',
        layout:
            'Section shell: {width: text|narrow|default|wide|full, contentMaxWidth?, zIndex?, overlapTop?: "-80px"} — full-bleed background with centered content column. Use for hero/CTA/atmosphere sections.',
        position:
            'sticky:{enabled,top} (rails inside column layouts), minHeight ("60vh"|"80vh"|"100svh"), contentAlign: start|center|end (vertical centering within minHeight).',
        animation:
            'animation.entrance:{type: fade-up|fade-in|slide-left|slide-right|zoom-in, stagger?:{interval:60|100|160}} — stagger cascades list items. Use sparingly; motion personality is global.',
        typography: 'typography:{fontFamily,fontSize,fontWeight,textColor,textAlign} — prefer theme defaults.',
        responsive: 'responsive:{tablet:{...},mobile:{...}} partial overrides; visibility:{desktop,tablet,mobile}.',
    },
    ornamentPresets: ORNAMENT_PRESETS,
    meshBackgroundHint:
        'For hero atmosphere prefer globalSettings theme.atmosphere (flat|soft|mesh|aurora + intensity) over per-component layers.',
};

const globalSettingsSchema = {
    description: 'Site-wide settings. In Phase A the composer should NOT change theme/fonts unless explicitly asked — pages inherit the institute theme.',
    fields: {
        theme: '{preset, atmosphere:{canvas:flat|soft|mesh|aurora, intensity:subtle|medium|bold}, headingScale, borderRadius:sharp|rounded|pill}',
        fonts: '{enabled, family} — from the registered font list.',
        motion: '{personality: none|calm|balanced|dynamic}',
    },
};

const doctrine = [
    'Output is a single Page object: {id, name, route, components: Component[]}. Component = {id, type, enabled:true, props, style?}.',
    'ids: kebab-case unique strings.',
    'NEVER emit htmlBlock. NEVER invent image URLs — only use media URLs provided in the source pack (or leave image fields empty).',
    'Data-bound components render live institute data; configure, do not fabricate their entries.',
    'Rhythm: open with ONE hero; use sectionHeading before dense sections; alternate section surface tints; end with a CTA and/or contact section.',
    'Copy: concise, benefit-led, in the institute\'s voice; use the institute\'s configured terminology for Course/Batch/etc. when provided.',
    'Styling: presets first; theme tokens over raw hex except where the brand demands a specific color.',
];

const catalog = {
    _generated: 'scripts/export-catalogue-schema-catalog.mjs — do not edit by hand',
    version: 1,
    components,
    styleSchema,
    globalSettingsSchema,
    doctrine,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2));
console.log(`wrote ${path.relative(ROOT, OUT)} — ${components.length} component types`);
