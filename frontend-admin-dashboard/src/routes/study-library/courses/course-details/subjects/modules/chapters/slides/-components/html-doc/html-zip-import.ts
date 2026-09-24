/**
 * Import a zipped HTML document — the shape Claude / ChatGPT hand back: an
 * index.html next to its css, js, images and fonts — into ONE self-contained
 * HTML string suitable for `document_slide.data` with type 'HTML'.
 *
 * A slide stores a single HTML string, so every local reference has to be
 * resolved before saving:
 *   - stylesheets (and their @imports) and local scripts are INLINED,
 *   - binary assets (images, fonts, media) are uploaded to S3 and their
 *     references rewritten to public URLs.
 * Remote URLs (https://, //cdn) and data: URIs are left exactly as they are —
 * the slide renders in a sandboxed iframe that can still fetch them.
 *
 * Uses the shared zip.js reader, which streams one entry at a time, so peak
 * memory is O(largest entry) rather than O(zip).
 */
import {
    openZipFile,
    type ZipHandle,
} from '@/components/common/study-library/bulk-content-uploading/zip-parser';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';

export interface HtmlZipImportProgress {
    phase: 'reading' | 'uploading' | 'building';
    done: number;
    total: number;
    /** Zip path currently being handled, for a live status line. */
    label?: string;
}

export interface HtmlZipImportResult {
    title: string;
    html: string;
    /** Zip path of the .html that became the slide. */
    entryPath: string;
    /** Other .html files in the zip; not imported. */
    skippedHtml: string[];
    uploadedAssets: number;
    inlinedStylesheets: number;
    inlinedScripts: number;
    /** Local refs that could not be read or uploaded; left pointing at the original path. */
    unresolved: string[];
    /** Things the author should know about the imported result. */
    warnings: string[];
    /** Size of the produced HTML string, in characters. */
    size: number;
}

const HTML_RE = /\.x?html?$/i;
const INDEX_RE = /(^|\/)index\.x?html?$/i;

/** Marker for a css url() that points inside the zip, resolved to a full path. */
const ZIP_REF = 'zip-asset:';
const CSS_URL_RE = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*;?/gi;

/** Max nested @import depth — guards against an import cycle. */
const MAX_IMPORT_DEPTH = 3;
/** Parallel S3 uploads. Enough to hide latency without swamping the tab. */
const UPLOAD_CONCURRENCY = 4;
/** Stored HTML past this size is worth warning about before it hits the DB. */
const LARGE_HTML_CHARS = 2_000_000;

const MIME_BY_EXT: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    pdf: 'application/pdf',
};

const mimeFor = (name: string): string =>
    MIME_BY_EXT[(name.toLowerCase().split('.').pop() || '').trim()] || 'application/octet-stream';

/**
 * Archiver noise that never carries content: the macOS resource-fork folder
 * and dotfiles (.DS_Store, .git/…). Skipping them keeps the entry picker from
 * choosing a junk "html" file.
 */
const isJunkPath = (path: string): boolean =>
    path.startsWith('__MACOSX/') || path.split('/').some((seg) => seg.startsWith('.'));

const isExternalRef = (ref: string): boolean =>
    /^(https?:)?\/\//i.test(ref) || /^(data|blob|mailto|tel|javascript):/i.test(ref);

/**
 * Resolve an href/src that appeared inside `fromPath` to an actual zip entry.
 * Handles ./ and ../ segments, a leading /, percent-encoding, and query or
 * fragment suffixes. Lookup is case-insensitive because zips written on
 * macOS/Windows disagree with the casing used in the markup often enough.
 * Returns null for external/data refs and for anything not in the archive.
 */
export const resolveZipPath = (
    fromPath: string,
    ref: string,
    index: ReadonlyMap<string, string>
): string | null => {
    const trimmed = (ref || '').trim();
    if (!trimmed || trimmed.startsWith('#') || isExternalRef(trimmed)) return null;

    const clean = trimmed.split('#')[0]?.split('?')[0] ?? '';
    if (!clean) return null;

    let decoded = clean;
    try {
        decoded = decodeURIComponent(clean);
    } catch {
        // Malformed escape — fall back to the raw text, which may still match.
    }

    const segments = decoded.startsWith('/') ? [] : fromPath.split('/').slice(0, -1);
    for (const seg of decoded.replace(/^\//, '').split('/')) {
        if (!seg || seg === '.') continue;
        if (seg === '..') segments.pop();
        else segments.push(seg);
    }
    return index.get(segments.join('/').toLowerCase()) ?? null;
};

/**
 * Rewrite every local url() in a stylesheet to `url("zip-asset:<full path>")`.
 * Done per stylesheet, against that file's OWN path, so nested @imports keep
 * correct relative bases once everything is concatenated into one <style>.
 */
const normalizeCssRefs = (
    css: string,
    ownPath: string,
    index: ReadonlyMap<string, string>
): string =>
    css.replace(CSS_URL_RE, (full, _quote, ref: string) => {
        const resolved = resolveZipPath(ownPath, ref, index);
        return resolved ? `url("${ZIP_REF}${resolved}")` : full;
    });

/**
 * Read a stylesheet, inline its @imports, and normalise all local url()s.
 *
 * Order matters: @import refs are collected from the RAW text and swapped for
 * placeholders before normalisation runs, because `@import url(x.css)` is
 * itself a url() — normalising first would rewrite it to a zip-asset marker
 * and the import would never resolve. Each imported sheet is normalised
 * against its own path, so a nested ../ resolves correctly once the sheets
 * are concatenated.
 */
const readStylesheet = async (
    zip: ZipHandle,
    path: string,
    index: ReadonlyMap<string, string>,
    depth = 0
): Promise<string> => {
    const raw = await zip.readText(path);
    if (depth >= MAX_IMPORT_DEPTH) return normalizeCssRefs(raw, path, index);

    const imports: Array<{ statement: string; ref: string }> = [];
    raw.replace(CSS_IMPORT_RE, (statement, _q1, url1: string, _q2, url2: string) => {
        imports.push({ statement, ref: url1 || url2 || '' });
        return statement;
    });

    // A comment placeholder carries no url(), so normalisation leaves it be.
    const placeholder = (i: number) => `/*__vac_import_${i}__*/`;
    let withPlaceholders = raw;
    const resolvedImports: Array<{ token: string; css: string }> = [];

    for (const [i, entry] of imports.entries()) {
        const resolved = resolveZipPath(path, entry.ref, index);
        if (!resolved) continue;
        const token = placeholder(i);
        withPlaceholders = withPlaceholders.replace(entry.statement, token);
        resolvedImports.push({
            token,
            css: await readStylesheet(zip, resolved, index, depth + 1),
        });
    }

    let css = normalizeCssRefs(withPlaceholders, path, index);
    for (const imported of resolvedImports) {
        css = css.replace(imported.token, `\n${imported.css}\n`);
    }
    return css;
};

/**
 * `</script` inside inlined JS would terminate the host <script> element when
 * the document is serialised. Escaping the slash is inert in JS source and is
 * what bundlers do for the same reason.
 */
const escapeScriptText = (js: string): string => js.replace(/<\/script/gi, '<\\/script');

/** Elements whose attribute may point at a binary asset inside the zip. */
const ASSET_ATTRS: ReadonlyArray<{ selector: string; attr: string; srcset?: boolean }> = [
    { selector: 'img[src]', attr: 'src' },
    { selector: 'img[srcset]', attr: 'srcset', srcset: true },
    { selector: 'source[src]', attr: 'src' },
    { selector: 'source[srcset]', attr: 'srcset', srcset: true },
    { selector: 'video[src]', attr: 'src' },
    { selector: 'video[poster]', attr: 'poster' },
    { selector: 'audio[src]', attr: 'src' },
    { selector: 'track[src]', attr: 'src' },
    { selector: 'embed[src]', attr: 'src' },
    { selector: 'object[data]', attr: 'data' },
    { selector: 'input[type="image"][src]', attr: 'src' },
    { selector: 'link[rel~="icon"][href]', attr: 'href' },
];

/** Split a srcset into its candidates, preserving each descriptor. */
const parseSrcset = (value: string): Array<{ url: string; descriptor: string }> =>
    value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const [url = '', ...rest] = part.split(/\s+/);
            return { url, descriptor: rest.join(' ') };
        });

const fileStem = (path: string): string =>
    (path.split('/').pop() || 'document').replace(/\.[^.]+$/, '');

/** index.html wins; otherwise the shallowest, then largest, .html file. */
const pickEntryHtml = <T extends { path: string; uncompressedSize: number }>(
    candidates: T[]
): T => {
    const indexes = candidates.filter((e) => INDEX_RE.test(e.path));
    const pool = indexes.length ? indexes : candidates;
    const depth = (p: string) => p.split('/').length;
    return [...pool].sort(
        (a, b) =>
            depth(a.path) - depth(b.path) ||
            b.uncompressedSize - a.uncompressedSize ||
            a.path.localeCompare(b.path)
    )[0] as T;
};

/**
 * Turn a zipped HTML document into a single self-contained HTML string,
 * uploading every local binary asset to S3 along the way.
 *
 * @param userId owner recorded on the uploaded assets.
 * @throws when the zip is unreadable, empty, or contains no .html file.
 */
export async function importHtmlZip(
    file: File,
    userId: string,
    onProgress: (progress: HtmlZipImportProgress) => void = () => {}
): Promise<HtmlZipImportResult> {
    const zip = await openZipFile(file);
    try {
        return await buildHtmlDocument(zip, userId, onProgress);
    } finally {
        await zip.close();
    }
}

/**
 * The whole transform, against an already-open archive. Exported so it can be
 * exercised with a stub ZipHandle: zip.js needs Blob.stream(), which the test
 * DOM does not implement, and its decoding is not what these tests are about.
 */
export async function buildHtmlDocument(
    zip: ZipHandle,
    userId: string,
    onProgress: (progress: HtmlZipImportProgress) => void = () => {}
): Promise<HtmlZipImportResult> {
    const files = zip.entries.filter((e) => !e.isDirectory && !isJunkPath(e.path));
    if (!files.length) throw new Error('This zip has no files in it.');

    const index = new Map(files.map((e) => [e.path.toLowerCase(), e.path]));
    const htmlFiles = files.filter((e) => HTML_RE.test(e.path));
    if (!htmlFiles.length) {
        throw new Error('No .html file found in this zip, so there is no document to import.');
    }

    const entry = pickEntryHtml(htmlFiles);
    const skippedHtml = htmlFiles.filter((e) => e.path !== entry.path).map((e) => e.path);
    const warnings: string[] = [];
    const unresolved: string[] = [];

    onProgress({ phase: 'reading', done: 0, total: 1, label: entry.path });
    const doc = new DOMParser().parseFromString(await zip.readText(entry.path), 'text/html');

    // Stylesheets already written inline; collected BEFORE the <link> pass so
    // the <style> elements that pass creates are not re-processed.
    const cssBlocks: Array<{ element: HTMLStyleElement; text: string }> = [];
    for (const style of Array.from(doc.querySelectorAll('style'))) {
        const text = style.textContent || '';
        if (!text.includes('url(')) continue;
        cssBlocks.push({
            element: style as HTMLStyleElement,
            text: normalizeCssRefs(text, entry.path, index),
        });
    }

    // <link rel="stylesheet"> → <style>. Remote stylesheets (Google Fonts and
    // friends) resolve to null and are deliberately left as <link>.
    let inlinedStylesheets = 0;
    for (const link of Array.from(doc.querySelectorAll('link[rel][href]'))) {
        const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/);
        if (!rel.includes('stylesheet')) continue;
        const href = link.getAttribute('href') || '';
        const resolved = resolveZipPath(entry.path, href, index);
        if (!resolved) continue;

        let css: string;
        try {
            css = await readStylesheet(zip, resolved, index);
        } catch {
            unresolved.push(resolved);
            continue;
        }
        const style = doc.createElement('style');
        style.setAttribute('data-imported-from', href);
        link.replaceWith(style);
        cssBlocks.push({ element: style, text: css });
        inlinedStylesheets++;
    }

    // Local <script src> → inline. Remote scripts stay as-is; the sandbox
    // allows scripts, so a CDN import still loads at render time.
    let inlinedScripts = 0;
    for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
        const src = script.getAttribute('src') || '';
        const resolved = resolveZipPath(entry.path, src, index);
        if (!resolved) continue;
        try {
            const js = await zip.readText(resolved);
            script.removeAttribute('src');
            script.textContent = escapeScriptText(js);
            inlinedScripts++;
            if ((script.getAttribute('type') || '').toLowerCase() === 'module') {
                warnings.push(
                    `${resolved} is an ES module; any relative import inside it will not resolve once inlined.`
                );
            }
        } catch {
            unresolved.push(resolved);
        }
    }

    // Everything the document still needs from inside the zip.
    const needed = new Set<string>();
    for (const { selector, attr, srcset } of ASSET_ATTRS) {
        for (const el of Array.from(doc.querySelectorAll(selector))) {
            const value = el.getAttribute(attr) || '';
            const refs = srcset ? parseSrcset(value).map((c) => c.url) : [value];
            for (const ref of refs) {
                const resolved = resolveZipPath(entry.path, ref, index);
                if (resolved) needed.add(resolved);
            }
        }
    }
    for (const block of cssBlocks) {
        for (const match of block.text.matchAll(new RegExp(`${ZIP_REF}([^"')]+)`, 'g'))) {
            if (match[1]) needed.add(match[1]);
        }
    }

    const assetPaths = [...needed];
    const urlByPath = new Map<string, string>();
    onProgress({ phase: 'uploading', done: 0, total: assetPaths.length });

    let cursor = 0;
    let completed = 0;
    const uploadWorker = async (): Promise<void> => {
        for (;;) {
            const path = assetPaths[cursor++];
            if (path === undefined) return;
            const name = path.split('/').pop() || 'asset';
            try {
                const extracted = await zip.extractFile(path, name);
                // Re-wrap so the asset carries a real content type: the shared
                // extractor only knows a handful of extensions and would send
                // svg/woff as application/octet-stream, which browsers refuse
                // to render.
                const typed = new File([extracted], name, { type: mimeFor(name) });
                const fileId = await UploadFileInS3(
                    typed,
                    () => {},
                    userId,
                    'STUDENTS',
                    undefined,
                    true
                );
                const url = fileId ? await getPublicUrl(fileId) : '';
                if (url) urlByPath.set(path, url);
                else unresolved.push(path);
            } catch {
                unresolved.push(path);
            }
            onProgress({
                phase: 'uploading',
                done: ++completed,
                total: assetPaths.length,
                label: name,
            });
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, assetPaths.length) }, uploadWorker)
    );

    onProgress({ phase: 'building', done: 0, total: 1 });

    // Point the markup at S3. An asset that failed to upload keeps its original
    // relative path — visibly broken rather than silently blank.
    for (const { selector, attr, srcset } of ASSET_ATTRS) {
        for (const el of Array.from(doc.querySelectorAll(selector))) {
            const value = el.getAttribute(attr) || '';
            if (srcset) {
                const rewritten = parseSrcset(value)
                    .map((candidate) => {
                        const resolved = resolveZipPath(entry.path, candidate.url, index);
                        const url = resolved ? urlByPath.get(resolved) : undefined;
                        const next = url || candidate.url;
                        return candidate.descriptor ? `${next} ${candidate.descriptor}` : next;
                    })
                    .join(', ');
                if (rewritten !== value) el.setAttribute(attr, rewritten);
                continue;
            }
            const resolved = resolveZipPath(entry.path, value, index);
            const url = resolved ? urlByPath.get(resolved) : undefined;
            if (url) el.setAttribute(attr, url);
        }
    }

    for (const block of cssBlocks) {
        block.element.textContent = block.text.replace(
            new RegExp(`${ZIP_REF}([^"')]+)`, 'g'),
            (full, path: string) => urlByPath.get(path) ?? full
        );
    }

    // srcDoc inherits the parent's encoding, but an explicit charset keeps the
    // document correct if it is ever served or downloaded on its own.
    if (!doc.querySelector('meta[charset]')) {
        const meta = doc.createElement('meta');
        meta.setAttribute('charset', 'utf-8');
        // A document parsed from a bare fragment can come back with no <head>.
        (doc.head ?? doc.documentElement)?.prepend(meta);
    }

    const html = `<!doctype html>\n${doc.documentElement.outerHTML}`;
    if (html.length > LARGE_HTML_CHARS) {
        warnings.push(
            `The imported document is ${Math.round(html.length / 1000)}k characters. Large documents can be slow to save and open.`
        );
    }
    if (skippedHtml.length) {
        warnings.push(
            `${skippedHtml.length} other HTML file(s) in the zip were not imported: ${skippedHtml.join(', ')}`
        );
    }

    onProgress({ phase: 'building', done: 1, total: 1 });

    return {
        title: (doc.title || '').trim() || fileStem(entry.path),
        html,
        entryPath: entry.path,
        skippedHtml,
        uploadedAssets: urlByPath.size,
        inlinedStylesheets,
        inlinedScripts,
        unresolved,
        warnings,
        size: html.length,
    };
}
