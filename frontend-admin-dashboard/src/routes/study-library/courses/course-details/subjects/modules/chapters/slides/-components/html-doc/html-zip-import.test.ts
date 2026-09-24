/**
 * @vitest-environment jsdom
 */
// jsdom rather than the suite's default happy-dom: happy-dom eagerly fetches
// <link href> and <script src> while parsing, which a real browser's DOMParser
// never does — the document it returns is inert. Those fetches surface as
// unhandled rejections and would redden the run. jsdom matches the browser.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ZipHandle } from '@/components/common/study-library/bulk-content-uploading/zip-parser';

vi.mock('@/services/upload_file', () => ({
    UploadFileInS3: vi.fn(async (file: File) => `id-${file.name}`),
    getPublicUrl: vi.fn(async (fileId: string) => `https://cdn.test/${fileId}`),
}));

import { UploadFileInS3 } from '@/services/upload_file';
import { buildHtmlDocument, resolveZipPath } from './html-zip-import';

/**
 * A stand-in for an opened archive. The real reader is zip.js, which needs
 * Blob.stream() — absent from the test DOM — and whose decoding is not what
 * these tests are checking; every behaviour below belongs to our transform.
 */
function fakeZip(files: Record<string, string>): ZipHandle {
    const entries = Object.entries(files).map(([path, content]) => ({
        path,
        isDirectory: false,
        uncompressedSize: content.length,
        utf8Name: true,
    }));
    const read = (path: string) => {
        const content = files[path];
        if (content === undefined) throw new Error(`Zip entry not found: ${path}`);
        return content;
    };
    return {
        entries,
        readText: async (path) => read(path),
        extractFile: async (path, fileName) =>
            new File([read(path)], fileName, { type: 'application/octet-stream' }),
        close: async () => undefined,
    };
}

const importZip = (files: Record<string, string>) => buildHtmlDocument(fakeZip(files), 'user-1');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('resolveZipPath', () => {
    const index = new Map([
        ['assets/logo.png', 'assets/logo.png'],
        ['images/my photo.png', 'images/my photo.png'],
        ['styles/main.css', 'styles/main.css'],
    ]);

    it('walks ../ out of the referencing file’s folder', () => {
        expect(resolveZipPath('pages/index.html', '../assets/logo.png', index)).toBe(
            'assets/logo.png'
        );
    });

    it('decodes percent-escapes so a spaced filename still matches', () => {
        expect(resolveZipPath('index.html', 'images/my%20photo.png', index)).toBe(
            'images/my photo.png'
        );
    });

    it('ignores a query string and fragment', () => {
        expect(resolveZipPath('index.html', 'styles/main.css?v=3#x', index)).toBe(
            'styles/main.css'
        );
    });

    it('returns null for anything not local to the zip', () => {
        for (const ref of [
            'https://cdn.example.com/a.png',
            '//cdn.example.com/a.png',
            'data:image/png;base64,AAA',
            '#section',
            '',
        ]) {
            expect(resolveZipPath('index.html', ref, index)).toBeNull();
        }
    });
});

describe('buildHtmlDocument', () => {
    it('refuses a zip with no HTML file', async () => {
        await expect(importZip({ 'notes.txt': 'hello' })).rejects.toThrow(/No \.html file/i);
    });

    it('refuses a SCORM package rather than flattening it into a page', async () => {
        await expect(
            importZip({
                'imsmanifest.xml': '<manifest/>',
                'index.html': '<html><body>scorm</body></html>',
            })
        ).rejects.toThrow(/SCORM Package slide type/i);
    });

    it('prefers index.html and reports the pages it skipped', async () => {
        const result = await importZip({
            'about.html': '<html><body>about</body></html>',
            'index.html': '<html><head><title>Guide</title></head><body>hi</body></html>',
        });

        expect(result.entryPath).toBe('index.html');
        expect(result.title).toBe('Guide');
        expect(result.skippedHtml).toEqual(['about.html']);
        expect(result.warnings.join(' ')).toContain('about.html');
    });

    it('falls back to the document filename when there is no <title>', async () => {
        const result = await importZip({ 'report.html': '<html><body>x</body></html>' });
        expect(result.title).toBe('report');
    });

    it('uploads images and rewrites src and srcset to their S3 URLs', async () => {
        const result = await importZip({
            'index.html': `<html><body>
                <img src="assets/logo.png">
                <img srcset="assets/logo.png 1x, assets/big.png 2x">
                <img src="https://cdn.example.com/remote.png">
            </body></html>`,
            'assets/logo.png': 'binary',
            'assets/big.png': 'binary',
        });

        expect(result.html).toContain('src="https://cdn.test/id-logo.png"');
        expect(result.html).toContain('https://cdn.test/id-big.png 2x');
        // Remote references are left exactly as the author wrote them.
        expect(result.html).toContain('https://cdn.example.com/remote.png');
        expect(result.uploadedAssets).toBe(2);
    });

    it('uploads a repeated asset only once', async () => {
        await importZip({
            'index.html':
                '<html><body><img src="a.png"><img src="./a.png"><img src="A.PNG"></body></html>',
            'a.png': 'binary',
        });
        expect(UploadFileInS3).toHaveBeenCalledTimes(1);
    });

    it('gives the uploaded file a real content type rather than octet-stream', async () => {
        await importZip({
            'index.html': '<html><body><img src="icon.svg"></body></html>',
            'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        });
        const uploaded = vi.mocked(UploadFileInS3).mock.calls[0]?.[0] as File;
        expect(uploaded.type).toBe('image/svg+xml');
    });

    it('inlines a linked stylesheet and points its url() at S3', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><link rel="stylesheet" href="css/main.css"></head><body></body></html>',
            'css/main.css': 'body{background:url(../img/bg.png)}',
            'img/bg.png': 'binary',
        });

        expect(result.inlinedStylesheets).toBe(1);
        expect(result.html).not.toContain('<link rel="stylesheet"');
        expect(result.html).toContain('background:url("https://cdn.test/id-bg.png")');
    });

    it('resolves @import urls against the imported file, not the entry page', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><link rel="stylesheet" href="css/main.css"></head><body></body></html>',
            'css/main.css': '@import url("parts/colors.css");',
            // Relative to parts/colors.css, ../../img/bg.png is img/bg.png.
            'css/parts/colors.css': 'a{background:url(../../img/bg.png)}',
            'img/bg.png': 'binary',
        });

        expect(result.html).toContain('https://cdn.test/id-bg.png');
    });

    it('leaves a remote stylesheet as a <link>', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><link rel="stylesheet" href="https://fonts.example.com/x.css"></head><body></body></html>',
            'index-unused.txt': 'x',
        });

        expect(result.inlinedStylesheets).toBe(0);
        expect(result.html).toContain('https://fonts.example.com/x.css');
    });

    it('inlines a local script but leaves a CDN script alone', async () => {
        const result = await importZip({
            'index.html': `<html><body>
                <script src="app.js"></script>
                <script src="https://cdn.example.com/lib.js"></script>
            </body></html>`,
            'app.js': 'console.log("local");',
        });

        expect(result.inlinedScripts).toBe(1);
        expect(result.html).toContain('console.log("local")');
        expect(result.html).not.toContain('src="app.js"');
        expect(result.html).toContain('https://cdn.example.com/lib.js');
    });

    it('moves a deferred script to the end of body so the DOM exists when it runs', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><script defer src="app.js"></script></head><body><div id="root"></div></body></html>',
            'app.js': 'document.getElementById("root").textContent = "ready";',
        });

        // Inlining drops the defer guarantee, so the script has to move.
        expect(result.html).not.toContain('defer');
        const rootAt = result.html.indexOf('id="root"');
        const scriptAt = result.html.indexOf('getElementById');
        expect(rootAt).toBeGreaterThan(-1);
        expect(scriptAt).toBeGreaterThan(rootAt);
    });

    it('leaves a non-deferred script where the author put it', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><script src="early.js"></script></head><body><div id="root"></div></body></html>',
            'early.js': 'window.EARLY = 1;',
        });

        const scriptAt = result.html.indexOf('window.EARLY');
        const rootAt = result.html.indexOf('id="root"');
        expect(scriptAt).toBeLessThan(rootAt);
    });

    it('neutralises a </script> inside inlined JS so the document still parses', async () => {
        const result = await importZip({
            'index.html': '<html><body><script src="app.js"></script></body></html>',
            'app.js': 'var s = "</script>";',
        });

        expect(result.html).toContain('<\\/script');
        // One real closing tag for the one script element — the string literal
        // inside it must not have produced a second.
        expect(result.html.match(/<\/script>/g)).toHaveLength(1);
    });

    it('keeps a failed upload pointing at its original path and reports it', async () => {
        vi.mocked(UploadFileInS3).mockRejectedValueOnce(new Error('S3 down'));
        const result = await importZip({
            'index.html': '<html><body><img src="broken.png"></body></html>',
            'broken.png': 'binary',
        });

        expect(result.unresolved).toEqual(['broken.png']);
        expect(result.uploadedAssets).toBe(0);
        expect(result.html).toContain('src="broken.png"');
    });

    it('ignores __MACOSX and dotfile entries when choosing the page', async () => {
        const result = await importZip({
            '__MACOSX/index.html': 'junk',
            '.hidden/index.html': 'junk',
            'real.html': '<html><head><title>Real</title></head><body></body></html>',
        });

        expect(result.entryPath).toBe('real.html');
        expect(result.skippedHtml).toEqual([]);
    });

    it('always emits a charset so the saved document stands on its own', async () => {
        const result = await importZip({ 'index.html': '<html><body>hi</body></html>' });
        expect(result.html).toMatch(/^<!doctype html>/);
        expect(result.html).toContain('charset="utf-8"');
    });

    it('uploads an asset a script loads at runtime and rewrites the literal', async () => {
        const result = await importZip({
            'index.html': '<html><body><script src="game.js"></script></body></html>',
            'game.js': "const hit = new Audio('sfx/hit.mp3');\nconst art = 'sprites/hero.png';",
            'sfx/hit.mp3': 'binary',
            'sprites/hero.png': 'binary',
        });

        expect(result.uploadedAssets).toBe(2);
        expect(result.html).toContain("'https://cdn.test/id-hit.mp3'");
        expect(result.html).toContain("'https://cdn.test/id-hero.png'");
    });

    it('rewrites runtime refs in a script the page already had inline', async () => {
        const result = await importZip({
            'index.html': '<html><body><script>const bg = "img/board.png";</script></body></html>',
            'img/board.png': 'binary',
        });

        expect(result.html).toContain('"https://cdn.test/id-board.png"');
    });

    it('does not upload a css or js file that is already inlined', async () => {
        const result = await importZip({
            'index.html':
                '<html><head><link rel="stylesheet" href="app.css"></head><body><script src="app.js"></script></body></html>',
            'app.css': 'body{color:red}',
            // Naming the inlined files in code must not cause an S3 copy.
            'app.js': "const files = ['app.css', 'app.js'];",
        });

        expect(result.uploadedAssets).toBe(0);
        expect(UploadFileInS3).not.toHaveBeenCalled();
    });

    it('uploads video sources, poster and captions', async () => {
        const result = await importZip({
            'index.html': `<html><body>
                <video poster="media/cover.jpg"><source src="media/clip.mp4"><track src="media/subs.vtt"></video>
            </body></html>`,
            'media/clip.mp4': 'binary',
            'media/cover.jpg': 'binary',
            'media/subs.vtt': 'binary',
        });

        expect(result.uploadedAssets).toBe(3);
        expect(result.html).toContain('https://cdn.test/id-clip.mp4');
        expect(result.html).toContain('https://cdn.test/id-cover.jpg');
    });

    it('uploads an embedded sub-page as html rather than leaving a dead path', async () => {
        await importZip({
            'index.html': '<html><body><iframe src="embed/widget.html"></iframe></body></html>',
            'embed/widget.html': '<html><body>widget</body></html>',
        });

        const uploaded = vi.mocked(UploadFileInS3).mock.calls[0]?.[0] as File;
        expect(uploaded.type).toBe('text/html');
    });

    it('reports progress through the upload phase', async () => {
        const phases: string[] = [];
        await buildHtmlDocument(
            fakeZip({
                'index.html': '<html><body><img src="a.png"></body></html>',
                'a.png': 'binary',
            }),
            'user-1',
            (p) => phases.push(`${p.phase}:${p.done}/${p.total}`)
        );

        expect(phases[0]).toBe('reading:0/1');
        expect(phases).toContain('uploading:1/1');
        expect(phases.at(-1)).toBe('building:1/1');
    });
});
