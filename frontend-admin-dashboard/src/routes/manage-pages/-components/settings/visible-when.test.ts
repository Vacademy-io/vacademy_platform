import { describe, expect, it } from 'vitest';
import {
    UNFILTERED_VIEW_PRESET,
    describeVisibleWhen,
    hasRuleWithoutParam,
    isUnfilteredPreset,
    normalizeVisibleWhen,
    visibleWhenForSave,
    withOp,
} from './visible-when';

describe('normalizeVisibleWhen', () => {
    it('cleans whatever is stored into an editable list', () => {
        expect(normalizeVisibleWhen(undefined)).toEqual([]);
        expect(normalizeVisibleWhen('nope')).toEqual([]);
        expect(
            normalizeVisibleWhen([
                { param: 'stream', op: 'empty', value: 'ignored' },
                { param: 'category', op: 'equals', value: 7 },
                { param: 'q', op: 'bogus' },
                null,
                ['x'],
                { op: 'notEquals' },
            ])
        ).toEqual([
            { param: 'stream', op: 'empty' },
            { param: 'category', op: 'equals', value: '7' },
            { param: 'q', op: 'empty' },
            { param: '', op: 'notEquals', value: '' },
        ]);
    });
});

describe('visibleWhenForSave', () => {
    it('drops the key (undefined) when no rule is left', () => {
        expect(visibleWhenForSave([])).toBeUndefined();
    });

    it('keeps value only where the operator uses one', () => {
        expect(
            visibleWhenForSave([
                { param: 'stream', op: 'empty', value: 'x' },
                { param: 'stream', op: 'equals' },
            ])
        ).toEqual([
            { param: 'stream', op: 'empty' },
            { param: 'stream', op: 'equals', value: '' },
        ]);
    });
});

describe('rule helpers', () => {
    it('switching operator drops or starts the value', () => {
        expect(withOp({ param: 'a', op: 'equals', value: 'x' }, 'notEmpty')).toEqual({ param: 'a', op: 'notEmpty' });
        expect(withOp({ param: 'a', op: 'empty' }, 'notEquals')).toEqual({ param: 'a', op: 'notEquals', value: '' });
        expect(withOp({ param: 'a', op: 'equals', value: 'x' }, 'notEquals')).toEqual({
            param: 'a',
            op: 'notEquals',
            value: 'x',
        });
    });

    it('recognises the unfiltered-view preset', () => {
        expect(UNFILTERED_VIEW_PRESET).toEqual([{ param: 'stream', op: 'empty' }]);
        expect(isUnfilteredPreset(UNFILTERED_VIEW_PRESET)).toBe(true);
        expect(isUnfilteredPreset([{ param: 'stream', op: 'notEmpty' }])).toBe(false);
        expect(isUnfilteredPreset([...UNFILTERED_VIEW_PRESET, { param: 'q', op: 'empty' }])).toBe(false);
    });

    it('spots rules the site would ignore', () => {
        expect(hasRuleWithoutParam([{ param: 'stream', op: 'empty' }])).toBe(false);
        expect(hasRuleWithoutParam([{ param: '  ', op: 'empty' }])).toBe(true);
        expect(hasRuleWithoutParam([{ op: 'empty' }])).toBe(true);
        expect(hasRuleWithoutParam([null])).toBe(true);
        expect(hasRuleWithoutParam(undefined)).toBe(false);
    });

    it('describes rules in plain words', () => {
        expect(describeVisibleWhen([])).toBe('Always shown');
        expect(describeVisibleWhen(UNFILTERED_VIEW_PRESET)).toBe('Only on the unfiltered view');
        expect(
            describeVisibleWhen([
                { param: 'stream', op: 'equals', value: 'shiksha' },
                { param: 'q', op: 'empty' },
            ])
        ).toBe('Only when ?stream is “shiksha” and ?q is empty');
    });
});
