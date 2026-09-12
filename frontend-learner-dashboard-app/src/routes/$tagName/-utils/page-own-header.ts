/**
 * Whether an authored page opens with a heading of its own.
 *
 * A catalogue page with a Title gets a coloured title bar rendered above it as
 * fallback chrome, so a bare page is not untitled. Pages that already open
 * with their own heading must opt out, or the visitor sees two titles stacked.
 */
const OPENS_WITH_OWN_TITLE = new Set([
    "heroSection",
    "sectionHeading",
    "detailBlocks",
    // A pasted HTML SECTION, which may carry the page's heading...
    "htmlBlock",
    // ...and a pasted whole PAGE, which always does: it is created by the
    // Add Page > HTML page flow as a page's only component and brings its own
    // header, nav and footer. Omitting it put a title bar above the7cs's own
    // branded header on the Toddler Reset page.
    "htmlPage",
    "banner",
]);

/**
 * `components` is the page's component list; disabled entries are ignored by
 * the caller before this is asked.
 */
export const pageOpensWithOwnHeader = (
    components: Array<{ type?: string } | null | undefined>,
): boolean =>
    components.some((c) => c?.type === "heroSection") ||
    OPENS_WITH_OWN_TITLE.has(components[0]?.type ?? "");
