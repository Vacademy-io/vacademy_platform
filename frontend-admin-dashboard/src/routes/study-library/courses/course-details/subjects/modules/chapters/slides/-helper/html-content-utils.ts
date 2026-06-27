/** Check if HTML content is effectively empty (shared across editor + slide-creation flows).
 *
 *  Guard philosophy: this check exists to prevent an accidentally-empty
 *  serialization from clobbering a slide's saved content on the backend.
 *  It MUST be permissive about what counts as content — false positives
 *  here surface to the user as "Could not read editor content" and
 *  block their save. Only flag as empty when we're extremely confident
 *  the document is truly blank.
 *
 *  Extracted from slide-material.tsx so non-editor flows (e.g. creating a
 *  DOC slide from generated lecture notes) can reuse the exact same guard
 *  without pulling in the heavy editor component.
 */
export function checkIsHtmlEmpty(data: string | null): boolean {
    if (!data) return true;

    const trimmed = data.trim();
    if (!trimmed) return true;

    // First: the very specific known empty wrappers the editor produces
    // when there's nothing at all. These are the ONLY shapes we flag
    // with confidence.
    if (
        trimmed === '<html><head></head><body><div></div></body></html>' ||
        trimmed === '<html><head></head><body></body></html>' ||
        trimmed === '<div></div>' ||
        trimmed === '<p></p>' ||
        trimmed === '<br>' ||
        trimmed === '<br/>' ||
        /^<p><br\s*\/?><\/p>$/.test(trimmed) ||
        /^<div><br\s*\/?><\/div>$/.test(trimmed)
    ) {
        return true;
    }

    // Media + Yoopta custom blocks + semantic elements (details/summary
    // from the accordion serializer, figures, tables, lists, code, etc.)
    // always count as content, even without visible text.
    if (
        /<(img|video|iframe|audio|source|embed|object|svg|canvas|details|summary|figure|table|ul|ol|pre|code|blockquote|hr)\b/i.test(
            data
        ) ||
        /\b(data-yoopta-type|data-meta-align|data-meta-depth|data-tabs|data-front|data-back)\s*=/i.test(
            data
        )
    ) {
        return false;
    }

    // Fallback: strip tags/entities/whitespace and check for any text.
    const textContent = data
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    return textContent.length === 0;
}
