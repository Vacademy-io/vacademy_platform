import { describe, expect, it } from 'vitest';
import {
    applyPostSubmitConfiguration,
    DEFAULT_POST_SUBMIT_CONFIGURATION,
    isDefaultPostSubmitConfiguration,
    isValidPostSubmitUrl,
    normalizePostSubmitConfiguration,
    parsePostSubmitConfiguration,
    POST_SUBMIT_CONFIG_KEY,
    validatePostSubmitConfiguration,
} from '../../audience-post-submit-settings';

const CONFIG = {
    ...DEFAULT_POST_SUBMIT_CONFIGURATION,
    enabled: true,
    successTitle: 'You are in',
    buttons: [
        {
            id: 'b1',
            text: 'Join the group',
            url: 'https://chat.example.com/abc',
            variant: 'primary' as const,
        },
    ],
    allowAnotherResponse: true,
    anotherResponseText: 'Add another attendee',
    redirectUrl: '/thanks',
    redirectDelaySeconds: 5,
};

describe('parsePostSubmitConfiguration', () => {
    it('returns defaults for a campaign with no setting_json', () => {
        expect(parsePostSubmitConfiguration(undefined)).toEqual(DEFAULT_POST_SUBMIT_CONFIGURATION);
        expect(parsePostSubmitConfiguration('')).toEqual(DEFAULT_POST_SUBMIT_CONFIGURATION);
    });

    it('returns defaults instead of throwing on a malformed blob', () => {
        expect(parsePostSubmitConfiguration('{not json')).toEqual(
            DEFAULT_POST_SUBMIT_CONFIGURATION
        );
        expect(parsePostSubmitConfiguration('[1,2,3]')).toEqual(DEFAULT_POST_SUBMIT_CONFIGURATION);
    });

    it('fills each missing key from the defaults', () => {
        const parsed = parsePostSubmitConfiguration(
            JSON.stringify({ [POST_SUBMIT_CONFIG_KEY]: { successTitle: 'Done' } })
        );
        expect(parsed.successTitle).toBe('Done');
        expect(parsed.successMessage).toBe(DEFAULT_POST_SUBMIT_CONFIGURATION.successMessage);
        expect(parsed.buttons).toEqual([]);
    });

    it('migrates the original single-button shape', () => {
        // The first cut of this feature wrote showCtaButton/ctaButtonText/
        // ctaButtonUrl; a campaign saved then must keep its button.
        const parsed = normalizePostSubmitConfiguration({
            showCtaButton: true,
            ctaButtonText: 'Join',
            ctaButtonUrl: 'https://chat.example.com',
        });
        expect(parsed.buttons).toHaveLength(1);
        expect(parsed.buttons[0]?.text).toBe('Join');
        expect(parsed.buttons[0]?.variant).toBe('primary');
    });

    it('caps the button list and drops fully-empty rows', () => {
        const parsed = normalizePostSubmitConfiguration({
            buttons: [
                { id: 'a', text: 'One', url: '/1' },
                { id: 'b', text: '', url: '' },
                { id: 'c', text: 'Three', url: '/3' },
                { id: 'd', text: 'Four', url: '/4' },
                { id: 'e', text: 'Five', url: '/5' },
                { id: 'f', text: 'Six', url: '/6' },
            ],
        });
        expect(parsed.buttons.map((b) => b.id)).toEqual(['a', 'c', 'd']);
    });

    it('clamps an out-of-range redirect delay instead of rejecting it', () => {
        const parsed = normalizePostSubmitConfiguration({ redirectDelaySeconds: 9999 });
        expect(parsed.redirectDelaySeconds).toBe(60);
        expect(
            normalizePostSubmitConfiguration({ redirectDelaySeconds: -4 }).redirectDelaySeconds
        ).toBe(0);
    });
});

describe('applyPostSubmitConfiguration', () => {
    it('round-trips through setting_json', () => {
        expect(parsePostSubmitConfiguration(applyPostSubmitConfiguration(null, CONFIG))).toEqual(
            CONFIG
        );
    });

    it('preserves other keys already in the blob', () => {
        // audience.setting_json also carries counsellor-allocation and workflow
        // settings written elsewhere — saving the campaign must not drop them.
        const existing = JSON.stringify({
            workflow_setting: { offset_day: 3 },
            SCHOOL_SETTING: { data: { COUNSELLOR_ALLOCATION_SETTING: { data: { mode: 'X' } } } },
        });
        const merged = JSON.parse(applyPostSubmitConfiguration(existing, CONFIG));
        expect(merged.workflow_setting).toEqual({ offset_day: 3 });
        expect(merged.SCHOOL_SETTING.data.COUNSELLOR_ALLOCATION_SETTING.data.mode).toBe('X');
        expect(merged[POST_SUBMIT_CONFIG_KEY].successTitle).toBe('You are in');
    });

    it('does not blow up on an unparsable existing blob', () => {
        const merged = JSON.parse(applyPostSubmitConfiguration('garbage', CONFIG));
        expect(merged[POST_SUBMIT_CONFIG_KEY].successTitle).toBe('You are in');
    });
});

describe('isValidPostSubmitUrl', () => {
    it('accepts blank (feature off), relative paths and http(s) links', () => {
        expect(isValidPostSubmitUrl('')).toBe(true);
        expect(isValidPostSubmitUrl('/thank-you')).toBe(true);
        expect(isValidPostSubmitUrl('https://example.com/x')).toBe(true);
    });

    it('rejects script and protocol-relative destinations', () => {
        expect(isValidPostSubmitUrl('javascript:alert(1)')).toBe(false);
        expect(isValidPostSubmitUrl('//evil.example.com')).toBe(false);
        expect(isValidPostSubmitUrl('ftp://example.com')).toBe(false);
    });
});

describe('validatePostSubmitConfiguration', () => {
    it('passes a complete config', () => {
        expect(validatePostSubmitConfiguration(CONFIG)).toBeNull();
    });

    it('requires text and a link on every button', () => {
        expect(
            validatePostSubmitConfiguration({
                ...CONFIG,
                buttons: [{ id: 'b1', text: '  ', url: '/x', variant: 'primary' }],
            })
        ).toMatch(/needs text/);
        expect(
            validatePostSubmitConfiguration({
                ...CONFIG,
                buttons: [{ id: 'b1', text: 'Go', url: '', variant: 'primary' }],
            })
        ).toMatch(/needs a link/);
    });

    it('names which button is wrong when there is more than one', () => {
        expect(
            validatePostSubmitConfiguration({
                ...CONFIG,
                buttons: [
                    { id: 'b1', text: 'Ok', url: '/ok', variant: 'primary' },
                    { id: 'b2', text: 'Bad', url: 'javascript:alert(1)', variant: 'secondary' },
                ],
            })
        ).toMatch(/Button 2/);
    });

    it('accepts a config with no buttons at all', () => {
        expect(validatePostSubmitConfiguration({ ...CONFIG, buttons: [] })).toBeNull();
    });

    it('rejects an unsafe redirect', () => {
        expect(
            validatePostSubmitConfiguration({ ...CONFIG, redirectUrl: 'javascript:alert(1)' })
        ).toMatch(/Redirect URL/);
    });
});

describe('isDefaultPostSubmitConfiguration', () => {
    it('is true for a campaign that never touched the card', () => {
        expect(isDefaultPostSubmitConfiguration(parsePostSubmitConfiguration(undefined))).toBe(
            true
        );
        expect(
            isDefaultPostSubmitConfiguration(
                parsePostSubmitConfiguration(
                    JSON.stringify({ workflow_setting: { offset_day: 1 } })
                )
            )
        ).toBe(true);
    });

    it('is false once anything is authored', () => {
        expect(isDefaultPostSubmitConfiguration(CONFIG)).toBe(false);
        expect(
            isDefaultPostSubmitConfiguration({
                ...DEFAULT_POST_SUBMIT_CONFIGURATION,
                enabled: true,
                successTitle: 'Hi',
            })
        ).toBe(false);
    });
});

describe('blank button rows', () => {
    // Add a button, change your mind, leave it blank: normalize drops it, so
    // validation must not block the save over a row that will never be stored.
    const blankRow = {
        ...DEFAULT_POST_SUBMIT_CONFIGURATION,
        enabled: true,
        buttons: [{ id: 'b1', text: '   ', url: '  ', variant: 'primary' as const }],
    };

    it('do not block the save', () => {
        expect(validatePostSubmitConfiguration(blankRow)).toBeNull();
    });

    it('are dropped on the way to the API', () => {
        expect(normalizePostSubmitConfiguration(blankRow).buttons).toEqual([]);
    });

    it('still block the save when only half-filled', () => {
        expect(
            validatePostSubmitConfiguration({
                ...DEFAULT_POST_SUBMIT_CONFIGURATION,
                enabled: true,
                buttons: [{ id: 'b1', text: 'Go', url: '', variant: 'primary' }],
            })
        ).toMatch(/needs a link/);
    });
});

describe('the master switch', () => {
    it('is OFF by default', () => {
        expect(DEFAULT_POST_SUBMIT_CONFIGURATION.enabled).toBe(false);
        expect(parsePostSubmitConfiguration(undefined).enabled).toBe(false);
    });

    it('makes an off config inert no matter what else is stored', () => {
        const off = { ...CONFIG, enabled: false };
        // Nothing may reach a respondent, and nothing may block the save.
        expect(isDefaultPostSubmitConfiguration(off)).toBe(true);
        expect(
            validatePostSubmitConfiguration({ ...off, redirectUrl: 'javascript:alert(1)' })
        ).toBeNull();
    });

    it('still validates once it is switched on', () => {
        expect(
            validatePostSubmitConfiguration({ ...CONFIG, redirectUrl: 'javascript:alert(1)' })
        ).toMatch(/Redirect URL/);
    });

    it('survives the setting_json round trip', () => {
        expect(
            parsePostSubmitConfiguration(applyPostSubmitConfiguration(null, CONFIG)).enabled
        ).toBe(true);
    });
});
