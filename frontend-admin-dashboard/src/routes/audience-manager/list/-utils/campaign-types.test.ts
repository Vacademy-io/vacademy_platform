import { describe, expect, it } from 'vitest';
import { buildCampaignTypeFilterOptions } from './campaign-types';

const defaults = [
    { value: 'Website', label: 'Website' },
    { value: 'Facebook', label: 'Facebook' },
];

describe('buildCampaignTypeFilterOptions', () => {
    it('keeps defaults first and ignores saved values that only differ in case', () => {
        const options = buildCampaignTypeFilterOptions(defaults, ['WEBSITE', 'FACEBOOK']);
        expect(options).toEqual(defaults);
    });

    it('appends custom saved types once, sorted, skipping blanks', () => {
        const options = buildCampaignTypeFilterOptions(defaults, [
            'ZOHO FORM',
            ' ',
            null,
            undefined,
            'MANUAL',
            'zoho form',
        ]);
        expect(options.map((o) => o.value)).toEqual(['Website', 'Facebook', 'MANUAL', 'ZOHO FORM']);
    });
});
