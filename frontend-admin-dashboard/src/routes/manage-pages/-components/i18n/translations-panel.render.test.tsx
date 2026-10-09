import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEditorStore } from '../../-stores/editor-store';
import { TranslationsPanel } from './TranslationsPanel';

/**
 * Global Settings → Languages → Translations: every page text of the site for
 * one language, edited inline, kept "same as English", or translated with AI
 * in batches — writing only the dictionary, never the English page texts.
 */

const translateSiteStrings = vi.fn();

vi.mock('../../-services/ai-page-service', () => ({
    translateSiteStrings: (...args: unknown[]) => translateSiteStrings(...args),
}));
vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));
vi.mock('@tanstack/react-query', async (orig) => ({
    ...(await orig<Record<string, unknown>>()),
    useQuery: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

const load = (hi: Record<string, string> = {}) =>
    useEditorStore.getState().setConfig({
        pages: [
            {
                id: 'home',
                route: 'home',
                components: [
                    {
                        id: 'h',
                        type: 'heroSection',
                        enabled: true,
                        props: {
                            title: 'Learn the Indian way',
                            subtitle: 'NEET',
                            buttonText: 'Join now',
                        },
                    },
                ],
            },
        ],
        globalSettings: {
            i18n: {
                enabled: true,
                defaultLocale: 'en',
                locales: [
                    { code: 'en', label: 'EN' },
                    { code: 'hi', label: 'हिन्दी' },
                ],
                strings: { hi },
            },
        },
    } as never);

const hi = () => useEditorStore.getState().config!.globalSettings.i18n!.strings!.hi!;
const base = () => useEditorStore.getState().config!.pages[0]!.components[0]!.props;

describe('TranslationsPanel', () => {
    beforeEach(() => {
        translateSiteStrings.mockReset();
        load({ 'Learn the Indian way': 'भारतीय तरीके से सीखें' });
    });

    it('lists what is missing and saves an inline translation on blur', () => {
        render(<TranslationsPanel open initialLocale="hi" onOpenChange={vi.fn()} />);
        expect(screen.getByText('हिन्दी: 1 of 3 translated · 2 missing')).toBeInTheDocument();
        // Missing only (default): the translated title is not listed.
        expect(screen.queryByText('Learn the Indian way')).not.toBeInTheDocument();
        const boxes = screen.getAllByRole('textbox', { name: 'हिन्दी translation' });
        fireEvent.change(boxes[1]!, { target: { value: 'अभी जुड़ें' } });
        expect(hi()['Join now']).toBeUndefined();
        fireEvent.blur(boxes[1]!);
        expect(hi()['Join now']).toBe('अभी जुड़ें');
        expect(base().buttonText).toBe('Join now');
    });

    it('keeps a brand name the same as English, which counts as translated', () => {
        render(<TranslationsPanel open initialLocale="hi" onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Same as English' })[0]!);
        expect(hi().NEET).toBe('NEET');
        expect(screen.getByText('हिन्दी: 2 of 3 translated · 1 missing')).toBeInTheDocument();
    });

    it('translates the missing texts with AI and offers to keep what the AI left unchanged', async () => {
        translateSiteStrings.mockResolvedValue({
            translations: { NEET: 'NEET', 'Join now': 'अभी जुड़ें' },
            failed: [],
            tm_hits: 0,
            run_id: 'r1',
            model: 'm',
            warnings: [],
        });
        render(<TranslationsPanel open initialLocale="hi" onOpenChange={vi.fn()} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Translate 2 missing with AI/ }));
        });
        expect(translateSiteStrings).toHaveBeenCalledTimes(1);
        expect(translateSiteStrings.mock.calls[0]![0]).toEqual({
            strings: ['NEET', 'Join now'],
            target_locale: 'hi',
            source_locale: 'en',
        });
        await waitFor(() => expect(hi()['Join now']).toBe('अभी जुड़ें'));
        expect(hi().NEET).toBeUndefined();
        fireEvent.click(screen.getByRole('button', { name: 'Keep them in English' }));
        expect(hi().NEET).toBe('NEET');
        expect(base()).toEqual({
            title: 'Learn the Indian way',
            subtitle: 'NEET',
            buttonText: 'Join now',
        });
    });

    it('shows the server reason when the AI call fails (e.g. no credits) and stops', async () => {
        translateSiteStrings.mockRejectedValue({
            response: {
                data: { detail: 'Insufficient credits: needs ~1 credits but the balance is 0.' },
            },
        });
        render(<TranslationsPanel open initialLocale="hi" onOpenChange={vi.fn()} />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Translate 2 missing with AI/ }));
        });
        expect(await screen.findByText(/Insufficient credits/)).toBeInTheDocument();
        expect(hi()).toEqual({ 'Learn the Indian way': 'भारतीय तरीके से सीखें' });
    });
});
