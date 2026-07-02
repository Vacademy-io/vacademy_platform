import { TUTORIALS_BASE_URL } from './tutorials';
import type { InstituteBrand } from './useInstituteBrand';

export function tutorialUrl(file: string): string {
    return `${TUTORIALS_BASE_URL}/${file}`;
}

/**
 * Fetch a walkthrough's HTML and inject the institute's branding, returning a
 * document string for an iframe `srcDoc`.
 *
 * The walkthroughs read `window.BRAND = { name, logo, url }` BEFORE their inline
 * script runs, so we set it in <head>; a second script before </body> (runs
 * AFTER the walkthrough's own script) applies the name/logo to the header and
 * re-tints the `--brand` accent.
 *
 * Requires the S3 bucket to allow cross-origin GET. If the fetch fails (CORS not
 * configured, offline), callers should fall back to a plain `<iframe src>` which
 * plays the walkthrough with its default chrome.
 */
export async function fetchBrandedTutorial(
    file: string,
    brand: InstituteBrand,
    signal?: AbortSignal
): Promise<string> {
    const res = await fetch(tutorialUrl(file), { signal });
    if (!res.ok) throw new Error(`tutorial fetch failed: ${res.status}`);
    return injectBrand(await res.text(), brand);
}

function injectBrand(html: string, brand: InstituteBrand): string {
    const pre =
        `<script>window.BRAND={` +
        `name:${JSON.stringify(brand.name || '')},` +
        `logo:${JSON.stringify(brand.logoUrl || '')},` +
        `url:${JSON.stringify(brand.url || '')}};</script>`;

    const color = /^#[0-9a-fA-F]{6}$/.test(brand.themeColor) ? brand.themeColor : '';
    const themeJs = color
        ? `var s=document.documentElement.style;` +
          `s.setProperty('--brand',${JSON.stringify(color)});` +
          `s.setProperty('--brand-bright',${JSON.stringify(color)});` +
          `s.setProperty('--brand-deep',${JSON.stringify(color)});` +
          `s.setProperty('--brand-soft',${JSON.stringify(color + '22')});`
        : '';

    const post =
        `<script>(function(){try{var b=window.BRAND||{};` +
        `var n=document.getElementById('brandName');if(b.name&&n){n.textContent=b.name;}` +
        `var bb=document.getElementById('brandBadge');if(b.logo&&bb){bb.innerHTML='<img alt="" src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover">';}` +
        themeJs +
        `}catch(e){}})();</script>`;

    let out = html.includes('</head>') ? html.replace('</head>', `${pre}</head>`) : `${pre}${html}`;
    out = out.includes('</body>') ? out.replace('</body>', `${post}</body>`) : `${out}${post}`;
    return out;
}
