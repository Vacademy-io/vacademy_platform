import { describe, expect, it } from 'vitest';
import {
    extractLeadSettingData,
    mergeLeadSettings,
    LEAD_SETTINGS_DEFAULTS,
} from '@/hooks/use-lead-settings';

// The endpoint answers with the SettingDto itself: { key, name, data }.
const settingDtoResponse = {
    key: 'LEAD_SETTING',
    name: 'Lead Settings',
    data: {
        enabled: true,
        showScoreInStudentsTable: false,
        labels: { tier: 'Interest Level', leadStatus: 'Action Label' },
    },
};

describe('extractLeadSettingData', () => {
    it('reads the config the real endpoint returns (response.data.data)', () => {
        const data = extractLeadSettingData(settingDtoResponse);
        expect(data?.labels).toEqual({ tier: 'Interest Level', leadStatus: 'Action Label' });
        expect(data?.showScoreInStudentsTable).toBe(false);
    });

    it('still reads a wrapped {[key]: {data}} payload', () => {
        const wrapped = { data: { LEAD_SETTING: { data: { labels: { tier: 'Heat' } } } } };
        expect(extractLeadSettingData(wrapped)?.labels).toEqual({ tier: 'Heat' });
    });

    it('returns undefined for an empty or malformed body', () => {
        expect(extractLeadSettingData(undefined)).toBeUndefined();
        expect(extractLeadSettingData(null)).toBeUndefined();
        expect(extractLeadSettingData({})).toBeUndefined();
        expect(extractLeadSettingData({ data: null })).toBeUndefined();
        expect(extractLeadSettingData('nope')).toBeUndefined();
    });
});

describe('mergeLeadSettings', () => {
    it('keeps the saved values and fills the rest from defaults', () => {
        const merged = mergeLeadSettings(extractLeadSettingData(settingDtoResponse));
        expect(merged.labels).toEqual({ tier: 'Interest Level', leadStatus: 'Action Label' });
        expect(merged.showScoreInStudentsTable).toBe(false);
        // untouched keys fall back
        expect(merged.showScoreInEnquiryTable).toBe(LEAD_SETTINGS_DEFAULTS.showScoreInEnquiryTable);
        expect(merged.recencyDecayDays).toBe(LEAD_SETTINGS_DEFAULTS.recencyDecayDays);
    });

    it('a partially-saved nested group cannot drop sibling keys', () => {
        const merged = mergeLeadSettings({ scoringWeights: { recency: 40 } as never });
        expect(merged.scoringWeights.recency).toBe(40);
        expect(merged.scoringWeights.engagement).toBe(
            LEAD_SETTINGS_DEFAULTS.scoringWeights.engagement
        );
    });

    it('falls back to defaults when nothing is saved', () => {
        expect(mergeLeadSettings(undefined)).toEqual(LEAD_SETTINGS_DEFAULTS);
    });
});
