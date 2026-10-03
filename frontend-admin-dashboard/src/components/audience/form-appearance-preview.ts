/**
 * Builds a standalone HTML document that approximates the public audience
 * response page for a given appearance config.
 *
 * Rendered into a sandboxed `<iframe srcdoc>` rather than as React nodes, for
 * three reasons:
 *
 *  1. **Custom CSS actually applies.** The whole point of the escape hatch is
 *     that an admin can restyle the page; a preview that silently ignores their
 *     stylesheet is worse than no preview. Inside an iframe their CSS cannot
 *     reach the dashboard's own chrome.
 *  2. **Custom HTML is contained.** `sandbox=""` grants nothing — no scripts,
 *     no forms, no navigation, no same-origin access.
 *  3. The learner page's real styling is Tailwind, which does not exist in this
 *     app's bundle for those class names. Hand-writing the CSS here keeps the
 *     preview honest about being an approximation.
 *
 * Brand colours are read off the live admin document, so the preview follows
 * the institute's actual theme instead of a hardcoded orange.
 */
import DOMPurify from 'dompurify';
import type { AudienceFormAppearance } from '@/services/audience-form-appearance';

export interface PreviewField {
    name: string;
    required: boolean;
}

export interface PreviewContext {
    campaignName: string;
    campaignDescription: string;
    campaignObjective: string;
    instituteName: string;
    fields: PreviewField[];
}

/**
 * The HSL triples this preview needs, with a CSS-level fallback each.
 *
 * Copied wholesale into the iframe's own `:root` rather than resolved to
 * literal colours here: the preview then tracks the institute's live theme
 * (a green-branded institute previews green), and there is no second palette
 * to drift out of sync. The fallbacks are raw `H S% L%` triples, so a missing
 * token degrades to a sane colour instead of an invalid declaration.
 */
const THEME_VARS: ReadonlyArray<[name: string, fallback: string]> = [
    ['--primary-500', '24 85% 54%'],
    ['--primary-100', '35 90% 92%'],
    ['--secondary-200', '210 32% 90%'],
    ['--success-600', '142 56% 44%'],
    ['--info-600', '214 77% 44%'],
    ['--warning-600', '37 100% 40%'],
    ['--neutral-700', '0 0% 25%'],
    ['--danger-600', '360 76% 58%'],
    ['--card', '0 0% 100%'],
    ['--border', '210 18% 84%'],
    ['--foreground', '222 84% 5%'],
    ['--muted-foreground', '215 16% 47%'],
    ['--muted', '210 40% 96%'],
];

/** `:root { … }` for the iframe, seeded from the live admin document. */
const themeRoot = (): string => {
    const live = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement);
    const declarations = THEME_VARS.map(([name, fallback]) => {
        const value = live?.getPropertyValue(name).trim();
        return `${name}: ${value || fallback};`;
    });
    return `:root{${declarations.join('')}}`;
};

const c = (name: string): string => `hsl(var(${name}))`;

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * Sanitize admin-authored HTML with the SAME allow-list the learner app applies
 * at render time (`sanitizePostSubmitHtml` in
 * routes/audience-response/-utils/post-submit-config.ts). Keep the two in sync:
 * a preview that shows markup the live page will strip is a preview that lies.
 *
 * It also removes the escape hazard. A regex that only rewrote closing tags
 * left `<script>` open, and an unterminated script element swallows the rest of
 * the document as script text — the preview would render blank from that point
 * on. DOMPurify drops the element entirely.
 */
const sanitizeHtml = (html: string): string =>
    DOMPurify.sanitize(html.slice(0, 20000), {
        ALLOWED_TAGS: [
            'a',
            'b',
            'blockquote',
            'br',
            'code',
            'div',
            'em',
            'figcaption',
            'figure',
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'hr',
            'i',
            'img',
            'li',
            'mark',
            'ol',
            'p',
            'pre',
            's',
            'small',
            'span',
            'strong',
            'sub',
            'sup',
            'table',
            'tbody',
            'td',
            'tfoot',
            'th',
            'thead',
            'tr',
            'u',
            'ul',
        ],
        ALLOWED_ATTR: [
            'class',
            'style',
            'title',
            'role',
            'aria-label',
            'aria-hidden',
            'href',
            'target',
            'rel',
            'src',
            'alt',
            'width',
            'height',
            'loading',
            'colspan',
            'rowspan',
            'scope',
            'start',
            'type',
        ],
        ALLOW_DATA_ATTR: false,
    });

/**
 * Mirror of the learner app's `sanitizeCustomCss`. Chiefly this strips `</`,
 * which is the only way out of a `<style>` element — without it an admin's
 * stylesheet could close the block and inject markup into the preview.
 */
const sanitizeCss = (css: string): string => {
    if (!css || !css.trim()) return '';
    return css
        .slice(0, 20000)
        .replace(/<\//g, '')
        .replace(/@import[^;{}]*;?/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/behavior\s*:/gi, '')
        .replace(/-moz-binding\s*:/gi, '')
        .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _quote, target: string) => {
            const value = target.trim();
            return /^(https?:\/\/|\/(?!\/)|data:image\/)/i.test(value) ? match : 'none';
        })
        .trim();
};

const ACCENT_VAR: Record<AudienceFormAppearance['accent'], string> = {
    primary: '--primary-500',
    success: '--success-600',
    info: '--info-600',
    warning: '--warning-600',
    neutral: '--neutral-700',
};

const WIDTH_REM: Record<AudienceFormAppearance['width'], string> = {
    narrow: '42rem',
    regular: '56rem',
    wide: '72rem',
};

const HIGHLIGHT_GLYPH: Record<AudienceFormAppearance['highlights'][number]['icon'], string> = {
    sparkle: '✦',
    shield: '🛡',
    clock: '◷',
    check: '✓',
    users: '👥',
    chat: '💬',
};

export const buildFormAppearancePreview = (
    config: AudienceFormAppearance,
    context: PreviewContext
): string => {
    const accent = c(ACCENT_VAR[config.accent]);
    const surface = c('--card');
    const border = c('--border');
    const text = c('--foreground');
    const mutedText = c('--muted-foreground');
    const mutedSurface = c('--muted');
    const brandSoft = c('--primary-100');
    const coolSoft = c('--secondary-200');
    const danger = c('--danger-600');

    const pageBackground =
        config.background === 'plain'
            ? surface
            : config.background === 'muted'
              ? mutedSurface
              : `radial-gradient(60rem 42rem at 5% -8%, ${brandSoft}, transparent 60%),
                 radial-gradient(52rem 38rem at 100% 6%, ${coolSoft}, transparent 58%),
                 ${mutedSurface}`;

    const cardShadow =
        config.cardStyle === 'elevated'
            ? '0 1px 2px 0 rgb(15 23 42 / 0.06)'
            : config.cardStyle === 'glass'
              ? '0 10px 25px -12px rgb(15 23 42 / 0.25)'
              : 'none';
    const cardBorder = config.cardStyle === 'flat' ? 'transparent' : border;

    const headline = escapeHtml(config.headline.trim() || context.campaignName || 'Your campaign');
    const introSource = config.subheadline.trim() || context.campaignDescription.trim();
    const intro = config.showDescription && introSource ? sanitizeHtml(introSource) : '';
    const objective = config.showObjective ? escapeHtml(context.campaignObjective.trim()) : '';
    const eyebrow = escapeHtml(config.eyebrow.trim());

    const highlights = config.highlights.filter((highlight) => highlight.text.trim());
    const highlightsHtml = highlights.length
        ? `<ul class="hl">${highlights
              .map(
                  (highlight) =>
                      `<li><span class="hl-i">${HIGHLIGHT_GLYPH[highlight.icon]}</span>${escapeHtml(
                          highlight.text
                      )}</li>`
              )
              .join('')}</ul>`
        : '';

    const heroHtml = config.heroHtml.trim()
        ? `<div class="vac-af-hero">${sanitizeHtml(config.heroHtml)}</div>`
        : `<div class="vac-af-hero">
              ${config.coverImageUrl.trim() ? `<div class="cover"></div>` : ''}
              ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}
              <h1>${headline}</h1>
              ${intro ? `<div class="intro">${intro}</div>` : ''}
              ${
                  objective
                      ? `<div class="objective"><p class="obj-label">Objective</p><p>${objective}</p></div>`
                      : ''
              }
              ${highlightsHtml}
           </div>`;

    const required = context.fields.filter((f) => f.required).length;
    const fieldsHtml = context.fields.length
        ? context.fields
              .map(
                  (field) =>
                      `<div class="field"><label>${escapeHtml(field.name)}${
                          field.required ? ' <span class="req">*</span>' : ''
                      }</label><div class="input"></div></div>`
              )
              .join('')
        : `<p class="empty">This campaign has no fields yet — add them above and they will appear here.</p>`;

    const progressHtml =
        config.showProgress && required > 0
            ? `<div class="meter"><div class="meter-row"><span>0 of ${required} required fields completed</span><span>0%</span></div><div class="meter-track"><div class="meter-fill"></div></div></div>`
            : '';

    const legendHtml = config.showRequiredLegend
        ? `<p class="legend"><span class="req">*</span> Required field</p>`
        : '';

    const cardHtml = `<div class="vac-af-card">
        <div class="vac-af-card-header">
            <h2>${escapeHtml(config.formTitle.trim() || 'Please fill in your details')}</h2>
            <p>${escapeHtml(
                config.formSubtitle.trim() ||
                    'This information will be used to contact you about the campaign.'
            )}</p>
            ${progressHtml}
            ${legendHtml}
        </div>
        <div class="vac-af-fields">${fieldsHtml}</div>
        <div class="submit-row"><span class="vac-af-submit">${escapeHtml(
            config.submitLabel.trim() || 'Submit Response'
        )}</span></div>
    </div>`;

    const bodyHtml =
        config.layout === 'split'
            ? `<div class="split"><div>${heroHtml}</div><div>${cardHtml}</div></div>`
            : config.layout === 'classic'
              ? `<div class="stack"><div class="vac-af-card hero-card">${heroHtml}</div>${cardHtml}</div>`
              : `<div class="stack">${heroHtml}${cardHtml}</div>`;

    const footerHtml = config.footerNote.trim()
        ? `<div class="vac-af-footer">${sanitizeHtml(config.footerNote)}</div>`
        : '';

    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
${themeRoot()}
  *,*::before,*::after { box-sizing: border-box; }
  body { margin:0; font-family:'Open Sans',system-ui,sans-serif; color:${text};
         background:${pageBackground}; background-repeat:no-repeat; min-height:100vh; }
  .vac-af-page { min-height:100vh; }
  .vac-af-header { position:sticky; top:0; display:flex; align-items:center; gap:.75rem;
                   background:${surface}; border-bottom:1px solid ${border}; padding:.75rem 1rem; }
  .logo { width:1.75rem; height:1.75rem; border-radius:999px; background:${accent}; flex:none; }
  .brand { font-size:1rem; font-weight:600; }
  main { padding:2rem 1rem 3rem; }
  .col { max-width:${WIDTH_REM[config.width]}; margin:0 auto; }
  .stack { display:flex; flex-direction:column; gap:1.5rem; }
  .split { display:grid; grid-template-columns:5fr 7fr; gap:1.5rem; align-items:start; }
  @media (max-width:640px){ .split { grid-template-columns:1fr; } }
  .vac-af-hero { display:flex; flex-direction:column; gap:.75rem; }
  .cover { height:6rem; border-radius:.75rem; background:${border}; }
  .eyebrow { align-self:flex-start; background:${brandSoft}; color:${accent}; border-radius:999px;
             padding:.25rem .75rem; font-size:.75rem; font-weight:600; letter-spacing:.06em;
             text-transform:uppercase; }
  h1 { font-size:1.75rem; line-height:1.2; margin:0; font-weight:600; }
  .intro { color:${mutedText}; font-size:1rem; line-height:1.6; }
  .intro p { margin:0 0 .5rem; }
  .objective { display:flex; flex-direction:column; gap:.25rem; border:1px solid ${border};
               background:${surface}; border-radius:.5rem; padding:1rem; }
  .obj-label { margin:0; font-size:.75rem; font-weight:600; letter-spacing:.06em;
               text-transform:uppercase; color:${mutedText}; }
  .objective p:last-child { margin:0; font-size:.875rem; }
  .hl { list-style:none; display:flex; flex-wrap:wrap; gap:.5rem; padding:0; margin:0; }
  .hl li { display:flex; align-items:center; gap:.5rem; border:1px solid ${border};
           background:${surface}; border-radius:999px; padding:.375rem .75rem; font-size:.75rem; }
  .hl-i { color:${accent}; }
  .vac-af-card { background:${config.cardStyle === 'glass' ? 'rgb(255 255 255 / 0.9)' : surface};
                 border:1px solid ${cardBorder}; border-radius:.5rem; box-shadow:${cardShadow};
                 padding:1.5rem; display:flex; flex-direction:column; gap:1.5rem; }
  .hero-card { gap:.75rem; }
  .vac-af-card-header { display:flex; flex-direction:column; gap:.5rem; }
  .vac-af-card-header h2 { margin:0; font-size:1.25rem; font-weight:600; }
  .vac-af-card-header p { margin:0; font-size:.875rem; color:${mutedText}; }
  .meter { display:flex; flex-direction:column; gap:.375rem; margin-top:.25rem; }
  .meter-row { display:flex; justify-content:space-between; font-size:.75rem; color:${mutedText}; }
  .meter-track { height:.375rem; border-radius:999px; background:${mutedSurface}; overflow:hidden; }
  .meter-fill { height:100%; width:0; background:${accent}; }
  .legend { margin:0; font-size:.75rem; color:${mutedText}; }
  .req { color:${danger}; }
  .vac-af-fields { display:flex; flex-direction:column; gap:1.25rem; }
  .field { display:flex; flex-direction:column; gap:.375rem; }
  .field label { font-size:.875rem; font-weight:600; }
  .input { height:2.5rem; border:1px solid ${border}; border-radius:.375rem; background:${surface}; }
  .empty { margin:0; font-size:.875rem; color:${mutedText}; }
  .submit-row { display:flex; justify-content:flex-end; }
  .vac-af-submit { display:inline-flex; align-items:center; justify-content:center; height:2.5rem;
                   min-width:10rem; padding:0 1.5rem; border-radius:.375rem; background:${accent};
                   color:${surface}; font-size:1rem; font-weight:600; }
  .vac-af-footer { max-width:36rem; margin:2rem auto 0; text-align:center; font-size:.75rem;
                   color:${mutedText}; }
  .vac-af-footer p { margin:0; }
${sanitizeCss(config.customCss)}
</style></head>
<body><div class="vac-af-page">
  <div class="vac-af-header"><div class="logo"></div><span class="brand">${escapeHtml(
      context.instituteName
  )}</span></div>
  <main><div class="col">${bodyHtml}${footerHtml}</div></main>
</div></body></html>`;
};
