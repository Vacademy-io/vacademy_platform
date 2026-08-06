/**
 * Placeholder text that older admin chapter-creation code wrote into
 * `chapter.description` for every new chapter. It is boilerplate, not an
 * author-entered description, so it is hidden wherever chapter descriptions
 * are shown to learners.
 *
 * Keep in sync with
 * frontend-admin-dashboard/src/constants/study-library/content-description.ts
 */
export const LEGACY_DEFAULT_CHAPTER_DESCRIPTION =
  "Click to view and access eBooks and video lectures for this chapter.";

/** Returns the author-entered description, or "" when it is empty/legacy boilerplate. */
export const getAuthoredChapterDescription = (
  description?: string | null
): string => {
  const text = (description ?? "").trim();
  return text === LEGACY_DEFAULT_CHAPTER_DESCRIPTION ? "" : text;
};
