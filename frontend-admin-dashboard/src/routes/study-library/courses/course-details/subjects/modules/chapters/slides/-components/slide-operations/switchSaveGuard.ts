/**
 * Cross-slide bleed guard for the doc-slide auto-save-on-switch.
 *
 * The slide editor is ONE shared Yoopta instance reused across slides (only the
 * React wrapper remounts). On a FAST slide-switch the editor can already hold the
 * INCOMING slide's content while the "save the slide you just left" routine runs —
 * so reading the live editor and attributing it to the OUTGOING slide writes one
 * slide's body into another slide's row (the confirmed "Lesson 1 landed inside
 * Document 2" data loss).
 *
 * This module is the single source of truth for the decision "should we persist
 * the outgoing slide, and with what content?". It is a PURE function so it can be
 * exhaustively unit-tested; slide-material.tsx's handleUnsavedPreviousDoc() calls
 * it and simply carries out the decision. Keeping the logic here (not inlined)
 * guarantees the tests exercise the exact code that ships.
 *
 * INVARIANT the tests pin: this function NEVER yields content that belongs to a
 * slide other than `previousId`.
 *   - 'save-live'   → caller serializes the live editor, which (per the guard) is
 *                     verified to still hold `previousId`'s content.
 *   - 'save-cached' → `content` is the cache, and the cache is returned ONLY when
 *                     it is tagged for `previousId`.
 *   - 'skip'        → nothing is written; the stored row is left intact.
 */

export type SwitchSaveDecision =
    | { action: 'save-live' }
    | { action: 'save-cached'; content: string }
    | { action: 'skip'; reason: 'no-previous' | 'no-trustworthy-copy' };

export interface SwitchSaveInputs {
    /** id of the slide we are switching AWAY from (the one to persist), or null. */
    previousId: string | null | undefined;
    /**
     * id of the slide whose content the shared editor CURRENTLY holds. Set
     * synchronously after every editor.setEditorValue(), so it always names the
     * editor's real content regardless of React effect timing.
     */
    editorLoadedSlideId: string | null | undefined;
    /**
     * Last successfully-serialized, NON-degraded editor HTML, tagged with the
     * slide it came from. Only ever written for a clean, non-empty serialize, so
     * it is a trustworthy per-slide fallback.
     */
    cache: { slideId: string | null; html: string };
    /** The app's empty-HTML predicate (slide-material.tsx checkIsHtmlEmpty). */
    isHtmlEmpty: (html: string) => boolean;
}

export function decideSwitchSave(input: SwitchSaveInputs): SwitchSaveDecision {
    const { previousId, editorLoadedSlideId, cache, isHtmlEmpty } = input;

    if (!previousId) {
        return { action: 'skip', reason: 'no-previous' };
    }

    // The editor still holds `previous`'s content — a live serialize is
    // authoritative and reflects any in-editor edits the user just made.
    if (editorLoadedSlideId === previousId) {
        return { action: 'save-live' };
    }

    // The editor has advanced to a DIFFERENT slide. The live editor value now
    // belongs to that other slide, so only the tagged cache can speak for
    // `previous` — and only when it is a real, non-empty snapshot of THAT slide.
    if (cache.slideId === previousId && !!cache.html && !isHtmlEmpty(cache.html)) {
        return { action: 'save-cached', content: cache.html };
    }

    // No trustworthy copy of `previous`'s content exists. Persisting anything
    // here would write the wrong slide's body into `previous`'s row, so skip and
    // leave the stored copy untouched. (An explicit Save, or the next switch once
    // the editor reloads `previous`, still persists real edits.)
    return { action: 'skip', reason: 'no-trustworthy-copy' };
}

/**
 * Whether a freshly-serialized editor HTML may be cached as the per-slide
 * fallback. Mirrors slide-material.tsx getCurrentEditorHTMLContent()'s cache
 * gate. Extracted so the "never cache degraded/empty content" rule — which keeps
 * decideSwitchSave's 'save-cached' branch safe — is itself unit-tested.
 */
export function shouldCacheSerialize(input: {
    html: string;
    degraded: boolean;
    isHtmlEmpty: (html: string) => boolean;
}): boolean {
    const { html, degraded, isHtmlEmpty } = input;
    return !isHtmlEmpty(html) && !degraded;
}
