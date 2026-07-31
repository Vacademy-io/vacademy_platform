/**
 * Shared rules for the free-text `description` on modules and chapters.
 *
 * These descriptions render on fixed-size folder cards in Course Details →
 * Content Structure (and on the learner's module/chapter cards), so they are
 * capped at authoring time and clamped at render time — a card must never grow
 * to fit its text.
 */

/**
 * Max characters accepted in a module / chapter description.
 *
 * Sized to the card: ~2 clamped lines at the card's width. Enforced by both the
 * input's `maxLength` (hard stop while typing/pasting) and the zod schema.
 */
export const CONTENT_DESCRIPTION_MAX_LENGTH = 200;

/**
 * Placeholder text that older chapter-creation code wrote into `chapter.description`
 * for every new chapter. It is boilerplate, not an author-entered description, so it
 * is hidden wherever chapter descriptions are rendered and cleared when the chapter
 * is edited.
 */
export const LEGACY_DEFAULT_CHAPTER_DESCRIPTION =
    'Click to view and access eBooks and video lectures for this chapter.';

/** Returns the author-entered description, or '' when it is empty/legacy boilerplate. */
export const getAuthoredChapterDescription = (description?: string | null): string => {
    const text = (description ?? '').trim();
    return text === LEGACY_DEFAULT_CHAPTER_DESCRIPTION ? '' : text;
};
