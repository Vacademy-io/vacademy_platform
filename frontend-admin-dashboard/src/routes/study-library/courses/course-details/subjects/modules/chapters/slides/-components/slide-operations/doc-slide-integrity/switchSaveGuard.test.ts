/**
 * Rapid-slide-switch data-loss regression suite.
 *
 * Pins the cross-slide bleed fix: switching between doc slides fast used to write
 * one slide's body into another slide's row (confirmed prod case: the film
 * "Lesson 1" content overwrote an unrelated "Document 2"). slide-material.tsx now
 * routes every auto-save-on-switch through decideSwitchSave(), which refuses to
 * persist unless the content provably belongs to the outgoing slide.
 *
 * These tests exercise the SHIPPED decision function directly (production imports
 * the same module), plus a state-machine simulator that reproduces fast-switch
 * timing without React, asserting the core invariant end-to-end:
 *
 *     NO slide's stored row is ever written with another slide's content.
 */
import { describe, it, expect } from 'vitest';
import {
    decideSwitchSave,
    shouldCacheSerialize,
    type SwitchSaveInputs,
} from '../switchSaveGuard';

// Mirror slide-material.tsx checkIsHtmlEmpty closely enough for these tests:
// blank / whitespace / empty-wrapper HTML counts as empty.
const isHtmlEmpty = (html: string): boolean => {
    if (!html) return true;
    const stripped = html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, '')
        .replace(/\s/g, '');
    return stripped.length === 0;
};

const cache = (slideId: string | null, html: string) => ({ slideId, html });

describe('decideSwitchSave — save-or-skip decision', () => {
    it('normal switch: editor still holds the outgoing slide -> save the live editor', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: 'A',
            cache: cache('A', '<p>A body</p>'),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'save-live' });
    });

    it('THE bleed case: editor advanced to another slide -> never write its body into `previous`', () => {
        // previous = "Document 2"; the editor already loaded the film "Lesson 1".
        const d = decideSwitchSave({
            previousId: 'document-2',
            editorLoadedSlideId: 'lesson-1',
            cache: cache('lesson-1', '<h1>Every Great Film…</h1>'),
            isHtmlEmpty,
        });
        expect(d.action).toBe('skip');
        // There is no branch that could hand back lesson-1's content for document-2.
        expect(JSON.stringify(d)).not.toContain('Every Great Film');
    });

    it('fast switch after editing: editor advanced, cache holds `previous` -> save the cached snapshot', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: 'B',
            cache: cache('A', '<p>A edited body</p>'),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'save-cached', content: '<p>A edited body</p>' });
    });

    it('editor advanced and cache belongs to a THIRD slide -> skip (no bleed from C either)', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: 'B',
            cache: cache('C', '<p>C body</p>'),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'skip', reason: 'no-trustworthy-copy' });
    });

    it('editor advanced, cache tagged `previous` but EMPTY -> skip (never clobber with blank)', () => {
        for (const empty of ['', '   ', '<p></p>', '<p>&nbsp;</p>', '<div><br></div>']) {
            const d = decideSwitchSave({
                previousId: 'A',
                editorLoadedSlideId: 'B',
                cache: cache('A', empty),
                isHtmlEmpty,
            });
            expect(d.action).toBe('skip');
        }
    });

    it('no previous slide -> skip', () => {
        for (const previousId of [null, undefined, '']) {
            const d = decideSwitchSave({
                previousId,
                editorLoadedSlideId: 'A',
                cache: cache('A', '<p>x</p>'),
                isHtmlEmpty,
            });
            expect(d).toEqual({ action: 'skip', reason: 'no-previous' });
        }
    });

    it('nothing loaded yet (editorLoadedSlideId null) but cache holds `previous` -> save-cached', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: null,
            cache: cache('A', '<p>A body</p>'),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'save-cached', content: '<p>A body</p>' });
    });

    it('nothing loaded and cache irrelevant -> skip', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: null,
            cache: cache(null, ''),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'skip', reason: 'no-trustworthy-copy' });
    });

    it('prefers the LIVE editor over the cache when both point at `previous`', () => {
        const d = decideSwitchSave({
            previousId: 'A',
            editorLoadedSlideId: 'A',
            cache: cache('A', '<p>stale cached A</p>'),
            isHtmlEmpty,
        });
        expect(d).toEqual({ action: 'save-live' }); // live picks up the latest edits
    });
});

describe('decideSwitchSave — INVARIANT: never yields another slide’s content', () => {
    // Model "content that belongs to slide X" as the tagged cache html. Sweep the
    // full matrix of (previous, editorLoaded, cacheOwner) and assert that whenever
    // the function says save-cached, the content is owned by `previous`; and
    // whenever it says save-live, the live editor is verified to hold `previous`.
    const ids = ['A', 'B', 'C', null] as const;

    it('exhaustive matrix holds the invariant', () => {
        for (const previousId of ids) {
            for (const editorLoadedSlideId of ids) {
                for (const cacheOwner of ids) {
                    const html = cacheOwner ? `OWNED_BY_${cacheOwner}` : '';
                    const input: SwitchSaveInputs = {
                        previousId,
                        editorLoadedSlideId,
                        cache: cache(cacheOwner, html),
                        isHtmlEmpty,
                    };
                    const d = decideSwitchSave(input);

                    if (d.action === 'save-cached') {
                        // The content handed back must belong to `previous`.
                        expect(d.content).toBe(`OWNED_BY_${previousId}`);
                        expect(cacheOwner).toBe(previousId);
                    }
                    if (d.action === 'save-live') {
                        // Live serialize is only sanctioned when the editor holds
                        // `previous` — so the bytes it will produce are `previous`'s.
                        expect(editorLoadedSlideId).toBe(previousId);
                        expect(previousId).not.toBeNull();
                    }
                }
            }
        }
    });
});

describe('shouldCacheSerialize — the fallback cache never stores lossy content', () => {
    it('caches a clean, non-empty serialize', () => {
        expect(
            shouldCacheSerialize({ html: '<p>real content</p>', degraded: false, isHtmlEmpty })
        ).toBe(true);
    });

    it('refuses to cache DEGRADED content (a block was dropped this pass)', () => {
        // Even though it "looks" non-empty, a degraded serialize is missing a block;
        // caching it would let the fallback resurrect an incomplete copy.
        expect(
            shouldCacheSerialize({ html: '<p>partial</p>', degraded: true, isHtmlEmpty })
        ).toBe(false);
    });

    it('refuses to cache empty content', () => {
        expect(shouldCacheSerialize({ html: '<p></p>', degraded: false, isHtmlEmpty })).toBe(false);
        expect(shouldCacheSerialize({ html: '', degraded: false, isHtmlEmpty })).toBe(false);
    });

    it('refuses when both empty and degraded', () => {
        expect(shouldCacheSerialize({ html: '', degraded: true, isHtmlEmpty })).toBe(false);
    });
});

/**
 * State-machine simulator: reproduces the shared-editor + refs across a sequence
 * of loads / edits / switches (including fast switches where the editor advances
 * before the outgoing slide's save fires), and records every write to a slide's
 * stored row. Asserts the end-to-end invariant that a row only ever receives its
 * OWN content.
 */
class EditorSim {
    editorLoadedSlideId: string | null = null;
    cacheRef: { slideId: string | null; html: string } = { slideId: null, html: '' };
    // stored[slideId] = the last content persisted to that slide's DB row.
    stored: Record<string, string> = {};
    // Every (rowSlideId, contentOwner) pair ever written — used to detect bleed.
    writes: Array<{ row: string; owner: string }> = [];

    // Load a slide into the shared editor (mirrors applyDocContentToEditor:
    // setEditorValue then editorLoadedSlideId = id).
    load(slideId: string) {
        this.editorLoadedSlideId = slideId;
    }

    // User edits the currently-loaded slide -> onChange serializes and (if clean)
    // caches, tagged with the slide the editor holds.
    edit() {
        const owner = this.editorLoadedSlideId;
        if (!owner) return;
        const html = `OWNED_BY_${owner}`;
        if (shouldCacheSerialize({ html, degraded: false, isHtmlEmpty })) {
            this.cacheRef = { slideId: owner, html };
        }
    }

    // Switch away from `previous`. Runs the exact production decision, then
    // performs the write the way handleUnsavedPreviousDoc would.
    switchAway(previousId: string | null) {
        const d = decideSwitchSave({
            previousId,
            editorLoadedSlideId: this.editorLoadedSlideId,
            cache: this.cacheRef,
            isHtmlEmpty,
        });
        if (d.action === 'skip' || !previousId) return;
        // save-live serializes the LIVE editor -> content owned by whatever the
        // editor currently holds (this is where a naive impl would bleed).
        const content =
            d.action === 'save-live'
                ? `OWNED_BY_${this.editorLoadedSlideId}`
                : d.content;
        const owner = content.replace('OWNED_BY_', '');
        this.stored[previousId] = content;
        this.writes.push({ row: previousId, owner });
    }

    assertNoBleed() {
        for (const w of this.writes) {
            expect(w.owner, `row ${w.row} was written with ${w.owner}'s content`).toBe(w.row);
        }
    }
}

describe('rapid-switch simulator — end-to-end no-bleed', () => {
    it('slow, deliberate editing saves each slide correctly', () => {
        const sim = new EditorSim();
        for (const id of ['A', 'B', 'C']) {
            sim.load(id);
            sim.edit();
            sim.switchAway(id);
        }
        expect(sim.stored).toEqual({
            A: 'OWNED_BY_A',
            B: 'OWNED_BY_B',
            C: 'OWNED_BY_C',
        });
        sim.assertNoBleed();
    });

    it('reproduces the prod bleed setup and proves it is now prevented', () => {
        // User edits "Lesson 1", then jumps to "Document 2"; the editor loads
        // Document 2, but the (async) Document-2 load lands BEFORE the Lesson-1
        // switch-save fires — the exact race that corrupted Document 2.
        const sim = new EditorSim();
        sim.load('lesson-1');
        sim.edit(); // cache = lesson-1
        sim.load('document-2'); // editor advances to document-2 before the save
        // Now the deferred "save the slide you left (lesson-1)" fires:
        sim.switchAway('lesson-1');
        // lesson-1 gets its OWN cached content (not document-2's), document-2 untouched.
        expect(sim.stored['lesson-1']).toBe('OWNED_BY_lesson-1');
        expect(sim.stored['document-2']).toBeUndefined();
        sim.assertNoBleed();
    });

    it('fast A->B->C->D bounce (nothing edited on intermediates) writes no wrong rows', () => {
        const sim = new EditorSim();
        sim.load('A');
        sim.edit(); // A edited
        // Bounce quickly: editor advances through B, C, D before saves fire.
        sim.load('B');
        sim.load('C');
        sim.load('D');
        // Deferred saves for the slides we left, now firing late & out of order:
        sim.switchAway('A'); // editor holds D, but cache still tags A -> save cached A
        sim.switchAway('B'); // never loaded content/edited -> skip
        sim.switchAway('C'); // never edited -> skip
        expect(sim.stored['A']).toBe('OWNED_BY_A');
        expect(sim.stored['B']).toBeUndefined();
        expect(sim.stored['C']).toBeUndefined();
        sim.assertNoBleed();
    });

    it('randomised fuzz: 500 interleaved load/edit/switch ops never bleed', () => {
        const slides = ['s1', 's2', 's3', 's4', 's5'];
        // Deterministic PRNG (no Math.random — keeps the test reproducible).
        let seed = 1234567;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        // Index is always in-range, so the element is defined; assert it to satisfy
        // the repo's noUncheckedIndexedAccess (arr[i] is otherwise T | undefined).
        const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)] as T;

        const sim = new EditorSim();
        for (let i = 0; i < 500; i++) {
            const op = rand();
            if (op < 0.4) {
                sim.load(pick(slides));
            } else if (op < 0.7) {
                sim.edit();
            } else {
                sim.switchAway(pick(slides));
            }
        }
        // The whole point: across any interleaving, no row ever got another
        // slide's content.
        sim.assertNoBleed();
    });
});
