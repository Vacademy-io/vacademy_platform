import { describe, expect, it } from 'vitest';
import { groupSkipsByReason, parseSyncResponse, syncSummaryLine } from './catalogue-sync';

const page = { id: 'pp-1', name: 'Store', code: 'store', mappings: [{ id: 'm1' }] };

describe('parseSyncResponse', () => {
    it('reads the documented shape: page fields spread with the summary', () => {
        const r = parseSyncResponse({
            ...page,
            added: 3,
            deactivated: 1,
            skipped: [{ package_session_id: 'ps-9', reason: 'No active invite' }],
            warnings: ['Mixed currencies: INR, USD'],
        });
        expect(r.page?.id).toBe('pp-1');
        expect(r.added).toBe(3);
        expect(r.deactivated).toBe(1);
        expect(r.skipped).toEqual([{ package_session_id: 'ps-9', reason: 'No active invite' }]);
        expect(r.warnings).toEqual(['Mixed currencies: INR, USD']);
    });

    it('reads a nested page and list-shaped figures', () => {
        const r = parseSyncResponse({ page, added: [{}, {}], deactivated: [{}], skipped: [], warnings: [] });
        expect(r.page?.code).toBe('store');
        expect(r.added).toBe(2);
        expect(r.deactivated).toBe(1);
    });

    it('never crashes on junk and returns no page when none is usable', () => {
        for (const junk of [null, undefined, 'x', 42, [], { added: -4, skipped: 'nope', warnings: [{}, 7] }]) {
            const r = parseSyncResponse(junk);
            expect(r.page).toBeNull();
            expect(r.added).toBe(0);
            expect(r.skipped).toEqual([]);
            expect(r.warnings).toEqual([]);
        }
    });

    it('fills in a missing reason and accepts camelCase ids and message objects', () => {
        const r = parseSyncResponse({
            skipped: [{ packageSessionId: 'ps-1' }, null],
            warnings: [{ message: 'Two gateways' }, '  '],
        });
        expect(r.skipped).toEqual([{ package_session_id: 'ps-1', reason: 'Not added' }]);
        expect(r.warnings).toEqual(['Two gateways']);
    });
});

describe('summaries', () => {
    it('groups skips by reason, most common first', () => {
        expect(
            groupSkipsByReason([
                { package_session_id: '1', reason: 'CPO' },
                { package_session_id: '2', reason: 'No invite' },
                { package_session_id: '3', reason: 'No invite' },
            ])
        ).toEqual([
            { reason: 'No invite', count: 2 },
            { reason: 'CPO', count: 1 },
        ]);
    });

    it('writes one plain line', () => {
        expect(syncSummaryLine({ added: 12, deactivated: 2, skipped: [{ package_session_id: 'x', reason: 'y' }] })).toBe(
            'Added 12 course versions · switched off 2 no longer in the catalogue · 1 not added'
        );
        expect(syncSummaryLine({ added: 1, deactivated: 0, skipped: [] })).toBe('Added 1 course version');
        expect(syncSummaryLine({ added: 0, deactivated: 0, skipped: [] })).toBe('Nothing new to add');
    });
});
