// Helpers for naming and downloading files stored in media_service / S3.
//
// The public URL media_service hands back is a plain S3 object URL whose last
// path segment is `<UUID>-<original-upload-name>`. When a file was uploaded
// without an extension (or with a content-type the browser downloads rather
// than previews), the saved file ends up with no extension — e.g. an evaluated
// answer copy that downloads without `.pdf`. These helpers guarantee the file
// the admin saves carries the correct extension regardless of how it was named
// at upload time.

// Canonical MIME -> extension map for the file kinds we deal with (evaluated
// copies / answer sheets are PDFs or scanned images).
const MIME_TO_EXTENSION: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

/** Extension (without dot) for a MIME type, or null if we don't recognise it. */
export function fileExtensionForMimeType(mimeType: string | undefined | null): string | null {
    if (!mimeType) return null;
    // Strip any `; charset=...` suffix and normalise case.
    const type = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    return MIME_TO_EXTENSION[type] ?? null;
}

/** True when the name already ends in a plausible file extension. */
function hasFileExtension(name: string): boolean {
    return /\.[a-z0-9]{1,6}$/i.test(name);
}

/**
 * Read the first bytes of a blob and infer the extension from its magic number.
 * Covers the files stored here (PDF + common images). Used as a fallback when
 * the S3-served Content-Type is missing or generic (e.g. octet-stream).
 */
async function sniffExtensionFromBlob(blob: Blob): Promise<string | null> {
    try {
        const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        if (header.length < 4) return null;
        // %PDF
        if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46)
            return 'pdf';
        // JPEG: FF D8 FF
        if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'jpg';
        // PNG: 89 50 4E 47
        if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47)
            return 'png';
        // GIF: "GIF8"
        if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38)
            return 'gif';
        // WEBP: "RIFF"...."WEBP"
        if (
            header.length >= 12 &&
            header[0] === 0x52 &&
            header[1] === 0x49 &&
            header[2] === 0x46 &&
            header[3] === 0x46 &&
            header[8] === 0x57 &&
            header[9] === 0x45 &&
            header[10] === 0x42 &&
            header[11] === 0x50
        )
            return 'webp';
        return null;
    } catch {
        return null;
    }
}

/** Extension already present at the end of a URL path (before any query), or null. */
function extensionFromUrl(url: string): string | null {
    try {
        const path = url.split('?')[0] ?? url;
        const last = path.substring(path.lastIndexOf('/') + 1);
        const match = last.match(/\.([a-z0-9]{1,6})$/i);
        return match?.[1]?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}

/** Turn an arbitrary label into a safe file-name stem. */
function sanitizeBaseName(baseName: string): string {
    const cleaned = baseName
        .trim()
        .replace(/\.[a-z0-9]{1,6}$/i, '') // drop any trailing extension in the label
        .replace(/[^a-z0-9\-_ ]/gi, '')
        .replace(/\s+/g, '-');
    return cleaned || 'file';
}

/**
 * If a File has no extension, append the one implied by its MIME type so the
 * name stored in S3 (and later downloaded) is correct. Files that already have
 * an extension, or whose type we don't recognise, are returned unchanged.
 */
export function ensureFileHasExtension(file: File): File {
    if (hasFileExtension(file.name)) return file;
    const ext = fileExtensionForMimeType(file.type);
    if (!ext) return file;
    const newName = `${file.name || 'file'}.${ext}`;
    return new File([file], newName, { type: file.type, lastModified: file.lastModified });
}

/**
 * Fetch a stored file by its (public) URL and trigger a browser download whose
 * name is `${baseName}.${ext}`, where `ext` is resolved from the served
 * Content-Type, then the file's magic bytes, then the URL, defaulting to
 * `defaultExt`. Falls back to opening the URL in a new tab if the fetch fails
 * (e.g. a CORS hiccup) so viewing never fully breaks.
 *
 * @returns true if the download was triggered, false if it fell back to opening the URL.
 */
export async function downloadFileFromUrl(
    url: string,
    baseName: string,
    defaultExt = 'pdf'
): Promise<boolean> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
        const blob = await response.blob();

        const ext =
            fileExtensionForMimeType(blob.type) ??
            (await sniffExtensionFromBlob(blob)) ??
            extensionFromUrl(url) ??
            defaultExt;

        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${sanitizeBaseName(baseName)}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        return true;
    } catch {
        // If we can't fetch the bytes (network/CORS), fall back to the old
        // behaviour so the admin can still reach the file.
        window.open(url, '_blank');
        return false;
    }
}
