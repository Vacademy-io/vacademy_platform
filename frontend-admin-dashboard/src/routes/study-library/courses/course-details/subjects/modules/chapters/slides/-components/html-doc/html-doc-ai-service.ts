import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GENERATE_HTML_DOCUMENT_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

function requestBody(p: GenerateHtmlParams) {
    const brand =
        p.brand && (p.brand.primaryColor || p.brand.logoUrl || p.brand.name)
            ? {
                  primary_color: p.brand.primaryColor || null,
                  logo_url: p.brand.logoUrl || null,
                  name: p.brand.name || null,
              }
            : null;
    return {
        prompt: p.prompt,
        current_html: p.currentHtml || null,
        brand,
        content_types: p.contentTypes?.length ? p.contentTypes : null,
        key_points: p.keyPoints?.length ? p.keyPoints : null,
        image_urls: p.imageUrls?.length ? p.imageUrls : null,
        reference_file_ids: p.referenceFileIds?.length ? p.referenceFileIds : null,
        institute_id: getInstituteId() || null,
        idempotency_key: p.idempotencyKey || null,
    };
}

/** Content sections the page can include, in order. */
export const HTML_CONTENT_TYPES = [
    { key: 'notes', label: 'Notes' },
    { key: 'flashcards', label: 'Flashcards' },
    { key: 'practical_examples', label: 'Practical examples' },
    { key: 'interactive_games', label: 'Interactive games' },
    { key: 'quiz', label: 'Quiz' },
    { key: 'assignment', label: 'Assignment' },
] as const;

export type BrandKit = {
    primaryColor?: string;
    logoUrl?: string;
    name?: string;
};

export type GenerateHtmlParams = {
    /** What the document should be (create) or how to change it (edit). */
    prompt: string;
    /** When present, this is an EDIT: apply the prompt to this existing HTML. */
    currentHtml?: string | null;
    /** Institute brand kit for a consistent look. */
    brand?: BrandKit | null;
    /** Sections to include (create), e.g. ['notes','quiz']. */
    contentTypes?: string[];
    /** Optional key points/topics the page must cover. */
    keyPoints?: string[];
    /** Uploaded image URLs to embed. */
    imageUrls?: string[];
    /** Uploaded PDF file ids — grounded via MathPix. */
    referenceFileIds?: string[];
    /** Dedup key so a retry can't double-charge credits. */
    idempotencyKey?: string;
};

/**
 * Ask ai-service to generate (or edit) the creative, self-contained HTML for an
 * HTML Document slide. Returns the raw HTML string to store in
 * document_slide.data and render inside the sandboxed iframe preview.
 */
export async function generateHtmlDocument({
    prompt,
    currentHtml,
    contentTypes,
    keyPoints,
    imageUrls,
    referenceFileIds,
    idempotencyKey,
}: GenerateHtmlParams): Promise<string> {
    const res = await authenticatedAxiosInstance.post<{ html: string; model: string }>(
        GENERATE_HTML_DOCUMENT_URL,
        requestBody({ prompt, currentHtml, contentTypes, keyPoints, imageUrls, referenceFileIds, idempotencyKey }),
        // Grounding + a rich page can take a while; give it room.
        { timeout: 180000 }
    );
    const html = res.data?.html || '';
    if (!html.trim()) throw new Error('The AI returned an empty document. Try rephrasing your prompt.');
    return html;
}

export type StreamHandlers = {
    /** Called with the accumulated HTML so far as tokens arrive. */
    onDelta?: (accumulated: string) => void;
    /** Abort to cancel generation. */
    signal?: AbortSignal;
};

/**
 * Streaming variant — the page HTML arrives token-by-token (SSE) so the author
 * watches it build live and can cancel. Resolves with the final HTML.
 */
export async function generateHtmlDocumentStream(
    params: GenerateHtmlParams,
    { onDelta, signal }: StreamHandlers = {}
): Promise<string> {
    const token = getTokenFromCookie(TokenKey.accessToken);
    const res = await fetch(`${GENERATE_HTML_DOCUMENT_URL}/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(requestBody(params)),
        signal,
    });
    if (!res.ok || !res.body) {
        let detail = `Request failed (${res.status})`;
        try {
            const j = await res.json();
            detail = j?.detail || detail;
        } catch {
            /* non-JSON error body */
        }
        throw new Error(detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let acc = '';
    let finalHtml = '';
    let errorDetail = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const evt of events) {
            const line = evt.split('\n').find((l) => l.startsWith('data:'));
            if (!line) continue;
            let obj: { delta?: string; done?: boolean; html?: string; error?: string };
            try {
                obj = JSON.parse(line.slice(5).trim());
            } catch {
                continue;
            }
            if (obj.delta) {
                acc += obj.delta;
                onDelta?.(acc);
            } else if (obj.done) {
                finalHtml = obj.html || acc;
            } else if (obj.error) {
                errorDetail = obj.error;
            }
        }
    }

    if (errorDetail) throw new Error(errorDetail);
    const html = finalHtml || acc;
    if (!html.trim()) throw new Error('The AI returned an empty document. Try rephrasing your prompt.');
    return html;
}
