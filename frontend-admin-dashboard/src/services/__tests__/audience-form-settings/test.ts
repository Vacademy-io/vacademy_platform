import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const axiosInstance = vi.fn();

vi.mock('@/lib/auth/axiosInstance', () => ({
    default: Object.assign(axiosInstance, { post }),
}));
vi.mock('@/lib/auth/instituteUtils', () => ({
    getCurrentInstituteId: () => 'inst-1',
}));

const load = async () => await import('../../audience-post-submit-settings');

describe('the Form Appearance feature switch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('is OFF for an institute that has never saved the setting', async () => {
        const { fetchAudienceFormSettings } = await load();
        axiosInstance.mockResolvedValueOnce({ data: { data: {} } });
        const settings = await fetchAudienceFormSettings();
        expect(settings.formAppearanceEnabled).toBe(false);
    });

    it('is OFF when the whole request fails', async () => {
        const { fetchAudienceFormSettings } = await load();
        axiosInstance.mockRejectedValueOnce(new Error('network'));
        const settings = await fetchAudienceFormSettings();
        expect(settings.formAppearanceEnabled).toBe(false);
    });

    it.each([
        ['a missing key', {}],
        ['null', { formAppearanceEnabled: null }],
        ['the string "true"', { formAppearanceEnabled: 'true' }],
        ['the number 1', { formAppearanceEnabled: 1 }],
    ])('stays OFF for %s — only a real boolean opts in', async (_label, data) => {
        const { fetchAudienceFormSettings } = await load();
        axiosInstance.mockResolvedValueOnce({ data: { data } });
        const settings = await fetchAudienceFormSettings();
        expect(settings.formAppearanceEnabled).toBe(false);
    });

    it('is ON once the institute saved it', async () => {
        const { fetchAudienceFormSettings } = await load();
        axiosInstance.mockResolvedValueOnce({
            data: { data: { formAppearanceEnabled: true } },
        });
        const settings = await fetchAudienceFormSettings();
        expect(settings.formAppearanceEnabled).toBe(true);
    });

    it('still returns the post-submit defaults alongside it', async () => {
        const { fetchAudienceFormSettings, DEFAULT_POST_SUBMIT_CONFIGURATION } = await load();
        axiosInstance.mockResolvedValueOnce({ data: { data: {} } });
        const settings = await fetchAudienceFormSettings();
        expect(settings.postSubmit).toEqual(DEFAULT_POST_SUBMIT_CONFIGURATION);
    });
});

describe('saving the institute setting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('writes BOTH keys — the POST replaces setting_data, so one alone wipes the other', async () => {
        const { saveAudienceFormSettings, DEFAULT_POST_SUBMIT_CONFIGURATION } = await load();
        post.mockResolvedValueOnce({});

        await saveAudienceFormSettings({
            postSubmit: { ...DEFAULT_POST_SUBMIT_CONFIGURATION, enabled: true },
            formAppearanceEnabled: true,
        });

        const [, payload] = post.mock.calls[0] as [
            string,
            { setting_data: Record<string, unknown> },
        ];
        expect(Object.keys(payload.setting_data).sort()).toEqual([
            'formAppearanceEnabled',
            'postSubmitConfiguration',
        ]);
        expect(payload.setting_data.formAppearanceEnabled).toBe(true);
    });

    it('round-trips a switched-off institute without losing the thank-you config', async () => {
        const { saveAudienceFormSettings, DEFAULT_POST_SUBMIT_CONFIGURATION } = await load();
        post.mockResolvedValueOnce({});

        await saveAudienceFormSettings({
            postSubmit: { ...DEFAULT_POST_SUBMIT_CONFIGURATION, successTitle: 'Kept' },
            formAppearanceEnabled: false,
        });

        const [, payload] = post.mock.calls[0] as [
            string,
            { setting_data: Record<string, unknown> },
        ];
        expect(payload.setting_data.formAppearanceEnabled).toBe(false);
        expect(
            (payload.setting_data.postSubmitConfiguration as { successTitle: string }).successTitle
        ).toBe('Kept');
    });
});
