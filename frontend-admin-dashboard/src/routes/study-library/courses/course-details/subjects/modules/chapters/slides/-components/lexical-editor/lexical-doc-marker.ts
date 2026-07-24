import type { Slide } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-hooks/use-slides';

/**
 * Marker-based routing between the two DOC-slide editors.
 *
 * Both the legacy Yoopta editor and the new Lexical editor persist
 * `document_slide.type = 'DOC'` with an HTML payload — the ONLY discriminator
 * is a `data-editor="lexical"` attribute on a wrapper <div> inside the stored
 * HTML. Docs carrying the marker open in Lexical; docs without it keep opening
 * in the (deprecated, frozen) Yoopta editor.
 *
 * This module must stay free of `lexical` imports so slide-material.tsx can
 * import it without pulling the lazy-loaded lexical-vendor chunk.
 */

export const LEXICAL_MARKER_REGEX = /data-editor\s*=\s*["']lexical["']/i;

export const isLexicalHtml = (html?: string | null): boolean =>
    !!html && LEXICAL_MARKER_REGEX.test(html);

/**
 * Detect whether a DOC slide belongs to the Lexical editor.
 *
 * IMPORTANT: checks ALL content sources (restorable local draft, draft `data`,
 * `published_data`) rather than the precedence-selected one. A brand-new
 * Lexical doc's marker-only `data` reads as "empty" to checkIsHtmlEmpty, so
 * precedence-based detection would discard it, misroute the slide into Yoopta,
 * and the first Yoopta save would erase the marker permanently.
 * A slide can never legitimately be Lexical in one source and Yoopta in
 * another — existing docs are never converted.
 */
export const isLexicalDocSlide = (
    slide: Slide | null | undefined,
    localDraftHtml?: string | null
): boolean =>
    isLexicalHtml(localDraftHtml) ||
    isLexicalHtml(slide?.document_slide?.data) ||
    isLexicalHtml(slide?.document_slide?.published_data);

/** Inner HTML for a freshly created (blank) Lexical document — the marker
 *  wrapper with one empty paragraph. Run through formatHTMLString() before
 *  sending to the backend. */
export const EMPTY_LEXICAL_INNER = '<div data-editor="lexical"><p></p></div>';
