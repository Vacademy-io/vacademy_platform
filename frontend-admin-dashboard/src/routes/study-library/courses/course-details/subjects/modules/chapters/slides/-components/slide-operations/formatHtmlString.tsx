/**
 * Strip query parameters from any AWS S3 URLs as these are public assets and
 * temporary signatures can be expired/stale. We only target hosts containing
 * "amazonaws.com" and remove everything after the first '?' character.
 *
 * IMPORTANT — why this only touches real URL attributes:
 * The previous implementation ran a blunt `…amazonaws\.com[^"'()<>\s]*\?…`
 * scan over the ENTIRE serialized slide. When an S3 URL sat inside a data-*
 * block (quiz/tabs), the JSON quotes there are entity-encoded (`&quot;`, not
 * literal `"`), so the negated character class never stopped at the URL's end —
 * it swallowed the rest of the block (and everything after it) up to the next
 * literal delimiter, and the `slice(0, '?')` replacement then DELETED that whole
 * swallowed span. A single freshly-uploaded image (signed `?…` URL) could wipe
 * the rest of the document. We now match only `src`/`href`/`poster` attribute
 * values, bounded by the attribute's own quote, so the match can never cross
 * into other content. data-* payloads are left untouched (the block editors
 * already base64-encode their JSON, and their internal images render from the
 * decoded value — they must not be rewritten here).
 */
export const stripAwsQueryParamsFromUrls = (htmlString: string): string => {
    if (!htmlString) return htmlString;

    const stripQuery = (url: string): string => {
        if (!/amazonaws\.com/i.test(url)) return url;
        const qIndex = url.indexOf('?');
        return qIndex === -1 ? url : url.slice(0, qIndex);
    };

    // (attr=)(quote)(value)(same quote). [^"'] excludes both quote styles, so
    // the value can never run past its own closing quote — the over-match that
    // caused the truncation is structurally impossible here. (Catastrophic
    // content loss from ANY cause is separately guarded on save by the
    // shrink-check in slide-material.tsx's autoPublishDocSlide — a length-based
    // fail-safe here would false-trigger on image-heavy slides where the signed
    // query strings are a large fraction of a small document.)
    const attrUrlRegex = /(\b(?:src|href|poster)\s*=\s*)(["'])([^"']*)\2/gi;
    return htmlString.replace(
        attrUrlRegex,
        (_match, prefix: string, quote: string, url: string): string =>
            `${prefix}${quote}${stripQuery(url)}${quote}`
    );
};

/**
 * A cell counts as empty only when it carries no visible text AND no media.
 * We keep media-only cells (an image with no caption) so normalization can
 * never silently drop content.
 */
const isTableCellEmpty = (cell: Element): boolean => {
    if ((cell.textContent || '').trim() !== '') return false;
    return !cell.querySelector('img, video, audio, iframe, source, svg');
};

const normalizeSingleTable = (tableHtml: string): string => {
    const doc = new DOMParser().parseFromString(tableHtml, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return tableHtml;

    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return tableHtml;

    // Bail on any merged cell — a colspan/rowspan > 1 makes per-row cell counts
    // legitimately uneven, so trimming "extra" cells there could corrupt the
    // grid. The ragged-table bug we fix only ever produces colspan=rowspan=1.
    const hasMergedCells = rows.some((row) =>
        Array.from(row.children).some((c) => {
            const cs = parseInt(c.getAttribute('colspan') || '1', 10);
            const rs = parseInt(c.getAttribute('rowspan') || '1', 10);
            return cs > 1 || rs > 1;
        })
    );
    if (hasMergedCells) return tableHtml;

    const colgroup = table.querySelector('colgroup');
    const colCount = colgroup ? colgroup.querySelectorAll('col').length : 0;

    // Widest row measured by its LAST non-empty cell — trailing empties (the
    // stray cells Yoopta leaves behind after a column delete/paste) don't count.
    let meaningfulCols = 0;
    const rowCells = rows.map((row) => {
        const cells = Array.from(row.children).filter(
            (c) => c.tagName === 'TD' || c.tagName === 'TH'
        );
        let lastNonEmpty = 0;
        cells.forEach((c, i) => {
            if (!isTableCellEmpty(c)) lastNonEmpty = i + 1;
        });
        meaningfulCols = Math.max(meaningfulCols, lastNonEmpty);
        return cells;
    });

    // Real column count: never below the colgroup, never drops a cell with
    // content. For a healthy table this equals every row's length → no change.
    const targetCols = Math.max(colCount, meaningfulCols, 1);

    let mutated = false;
    rowCells.forEach((cells, rowIdx) => {
        const row = rows[rowIdx];
        if (!row) return;
        // Drop trailing EMPTY cells past the real width; stop at the first
        // non-empty from the right so real content is always preserved.
        for (let i = cells.length - 1; i >= targetCols; i--) {
            const cell = cells[i];
            if (cell && isTableCellEmpty(cell)) {
                row.removeChild(cell);
                mutated = true;
            } else {
                break;
            }
        }
        // Pad short rows so the grid is rectangular.
        const remaining = Array.from(row.children).filter(
            (c) => c.tagName === 'TD' || c.tagName === 'TH'
        ).length;
        for (let i = remaining; i < targetCols; i++) {
            const td = doc.createElement('td');
            td.setAttribute('rowspan', '1');
            td.setAttribute('colspan', '1');
            row.appendChild(td);
            mutated = true;
        }
    });

    // Sync the <colgroup> width so the browser lays out exactly targetCols.
    if (colgroup && colCount !== targetCols) {
        const cols = Array.from(colgroup.querySelectorAll('col'));
        const template = cols[cols.length - 1];
        for (let i = cols.length; i < targetCols; i++) {
            const col = doc.createElement('col');
            const tplStyle = template?.getAttribute('style');
            if (tplStyle) col.setAttribute('style', tplStyle);
            colgroup.appendChild(col);
        }
        for (let i = cols.length - 1; i >= targetCols; i--) {
            const col = cols[i];
            if (col) colgroup.removeChild(col);
        }
        mutated = true;
    }

    // Only reserialize when we actually changed something, so healthy tables
    // stay byte-identical and the unsaved-changes comparison doesn't churn.
    return mutated ? table.outerHTML : tableHtml;
};

/**
 * Yoopta's table plugin can emit rows with MORE <td> cells than the table's
 * real column count — trailing empty cells left behind after a column delete,
 * or ragged rows from paste/merge. Those stray empties stretch the rendered
 * table with dead columns past the real content (and past the <colgroup>).
 * Normalize every simple (non-merged) <table> so all rows share one column
 * count: drop trailing empty cells and pad short rows into a clean grid.
 * Cells with any content are never removed, so this cannot lose data.
 */
export const normalizeTableColumns = (htmlString: string): string => {
    if (typeof DOMParser === 'undefined' || !htmlString.includes('<table')) {
        return htmlString;
    }
    // Operate only on <table>…</table> substrings so the rest of the document
    // stays byte-identical (a full DOMParser round-trip would reformat
    // unrelated markup and trip the unsaved-changes comparison). Yoopta tables
    // never nest, so a non-greedy match to the first </table> is safe.
    return htmlString.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
        try {
            return normalizeSingleTable(tableHtml);
        } catch {
            return tableHtml; // never let a normalization glitch drop the table
        }
    });
};

export const formatHTMLString = (htmlString: string) => {
    // Strip any existing html/head/body wrappers first to make this idempotent.
    // This prevents double-wrapping on repeated save cycles.
    let cleanedHtml = htmlString
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '');

    // Remove data-meta attributes and style from paragraphs. The \s guard
    // prevents matching <pre …> (prefix-share with <p), which would turn
    // <pre …>…</pre> into malformed <p>…</pre> and destroy code blocks.
    cleanedHtml = cleanedHtml.replace(/<p\s[^>]*data-meta[^>]*style="[^"]*"[^>]*>/g, '<p>');

    // Drop empty image blocks. The Yoopta Image plugin initialises new
    // blocks with src=null; if the user opens the uploader and closes it
    // without uploading, the template literal serializes src="null" and
    // the block re-appears as a broken thumbnail on every reload.
    cleanedHtml = cleanedHtml.replace(
        /<div[^>]*>\s*<img[^>]*\ssrc="(?:null|undefined|)"[^>]*\/?>\s*<\/div>/gi,
        ''
    );
    cleanedHtml = cleanedHtml.replace(
        /<img[^>]*\ssrc="(?:null|undefined|)"[^>]*\/?>(?!\s*<\/div>)/gi,
        ''
    );

    // Strip expired query params from public S3 URLs
    cleanedHtml = stripAwsQueryParamsFromUrls(cleanedHtml);

    // Repair ragged tables — rows with trailing empty cells past the real
    // column count render as a table stretched with dead columns.
    cleanedHtml = normalizeTableColumns(cleanedHtml);

    // Trim whitespace from stripping
    cleanedHtml = cleanedHtml.trim();

    // Add proper HTML structure
    const formattedHtml = `<html>
    <head></head>
    <body>
        <div>
            ${cleanedHtml}
        </div>
    </body>
</html>`;

    return formattedHtml;
};
