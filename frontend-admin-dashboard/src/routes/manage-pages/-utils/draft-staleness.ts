/**
 * Is the open draft older than the live site?
 *
 * The editor opens the draft whenever one exists. If the live site changed
 * after that draft was started (another editor, an AI tool, a script),
 * publishing the draft would quietly put the older version back live.
 *
 * Servers that compare the two send `live_changed_since_draft` with the draft;
 * that answer wins. Older servers do not, so the editor falls back to: the
 * draft differs from the live JSON AND it was started before the live site
 * last changed.
 */
import isEqual from 'lodash.isequal';
import type { CatalogueMeta, CatalogueRevision } from '../-services/catalogue-service';

export interface DraftStaleness {
    stale: boolean;
    draftStartedAt?: string;
    liveRevisionNo?: number;
    liveUpdatedAt?: string;
}

type When = string | number | undefined | null;

const toTime = (value: When) => {
    if (value === undefined || value === null || value === '') return NaN;
    return new Date(value).getTime();
};

/** Same site, however it was formatted (Python `", "` separators, key order). */
export const sameCatalogueJson = (a?: string | null, b?: string | null) => {
    if (!a || !b) return a === b;
    try {
        return isEqual(JSON.parse(a), JSON.parse(b));
    } catch {
        return a === b;
    }
};

/** The PUBLISHED revision that is live now: the one published last. A promoted
 *  draft keeps its old revision number, so the newest number is not enough. */
export const findLiveRevision = (revisions?: CatalogueRevision[] | null) => {
    let live: CatalogueRevision | undefined;
    for (const r of revisions ?? []) {
        if (r.status !== 'PUBLISHED') continue;
        const at = toTime(r.updated_at ?? r.created_at);
        if (!live || at > toTime(live.updated_at ?? live.created_at)) live = r;
    }
    return live;
};

/** True when the client-side check needs the revision history to decide. */
export const needsHistoryForStaleness = (
    draft?: CatalogueRevision | null,
    meta?: CatalogueMeta | null
) =>
    !!draft &&
    !!meta &&
    typeof draft.live_changed_since_draft !== 'boolean' &&
    !meta.updated_at &&
    !sameCatalogueJson(draft.catalogue_json, meta.catalogue_json);

export const getDraftStaleness = (
    draft?: CatalogueRevision | null,
    meta?: CatalogueMeta | null,
    revisions?: CatalogueRevision[] | null
): DraftStaleness => {
    if (!draft || !meta) return { stale: false };
    const draftStartedAt = draft.created_at;

    if (typeof draft.live_changed_since_draft === 'boolean') {
        return {
            stale: draft.live_changed_since_draft,
            draftStartedAt,
            liveRevisionNo: draft.live_revision_no,
            liveUpdatedAt: draft.live_updated_at,
        };
    }

    const live = findLiveRevision(revisions);
    const liveUpdatedAt = meta.updated_at ?? live?.updated_at ?? live?.created_at;
    const startedBeforeLive = toTime(draftStartedAt) < toTime(liveUpdatedAt);
    return {
        stale: startedBeforeLive && !sameCatalogueJson(draft.catalogue_json, meta.catalogue_json),
        draftStartedAt,
        liveRevisionNo: live?.revision_no,
        liveUpdatedAt,
    };
};
