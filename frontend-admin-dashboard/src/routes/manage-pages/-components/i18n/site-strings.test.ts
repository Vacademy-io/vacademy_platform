import { describe, expect, it } from 'vitest';
import type { CatalogueConfig } from '../../-types/editor-types';
import {
    batchForTranslation,
    collectSiteStrings,
    coverageOf,
    isKeptAsBase,
    keepAsBase,
    mergeAiTranslations,
    setTranslation,
    siteCoverage,
} from './site-strings';
import {
    courseCardDescription,
    courseTextsFromRows,
    dedupeLiveTexts,
    folderTextsFromNodes,
    isLiveText,
} from './translation-sources';
import type { FolderNode } from '../../-services/folder-library-service';

const site = (i18n?: Record<string, unknown>) =>
    ({
        globalSettings: {
            courseCatalogeType: { enabled: true, value: 'Course' },
            layout: {
                header: {
                    type: 'header',
                    props: {
                        title: 'Smart Academy',
                        navigation: [{ label: 'Courses', route: 'courses' }],
                    },
                },
                footer: {
                    type: 'footer',
                    enabled: false,
                    props: { bottomNote: 'Hidden footer note' },
                },
            },
            ...(i18n ? { i18n } : {}),
        },
        pages: [
            {
                id: 'home',
                route: 'home',
                seo: {
                    metaTitle: 'Home of learning',
                    metaDescription: '',
                    ogImage: 'https://cdn.example.org/a.png',
                },
                components: [
                    {
                        id: 'h',
                        type: 'heroSection',
                        enabled: true,
                        props: {
                            title: 'Learn the Indian way',
                            layout: 'split',
                            defaultSort: 'Newest',
                        },
                    },
                    {
                        id: 'x',
                        type: 'faqSection',
                        enabled: false,
                        props: { title: 'Hidden section' },
                    },
                    {
                        id: 'c',
                        type: 'columnLayout',
                        enabled: true,
                        props: {
                            slots: [
                                [
                                    {
                                        id: 't',
                                        type: 'textBlock',
                                        enabled: true,
                                        props: { content: 'Inside a column' },
                                    },
                                ],
                            ],
                        },
                    },
                    {
                        id: 'd',
                        type: 'ctaBanner',
                        enabled: true,
                        props: { text: 'Courses', buttonText: 'Join now' },
                    },
                ],
            },
        ],
    }) as unknown as CatalogueConfig;

describe('collectSiteStrings', () => {
    it('collects header, sections, column children and page SEO in reading order, once each', () => {
        expect(collectSiteStrings(site())).toEqual([
            'Smart Academy',
            'Courses',
            'Learn the Indian way',
            'Inside a column',
            'Join now',
            'Home of learning',
        ]);
    });

    it('skips hidden sections, hidden header/footer and values that are data (sorts, layouts, links)', () => {
        const strings = collectSiteStrings(site());
        expect(strings).not.toContain('Hidden section');
        expect(strings).not.toContain('Hidden footer note');
        expect(strings).not.toContain('Newest');
        expect(strings).not.toContain('split');
        expect(strings).not.toContain('https://cdn.example.org/a.png');
    });

    it('is empty without a config', () => {
        expect(collectSiteStrings(null)).toEqual([]);
    });

    it('leaves out text-shaped props no visitor reads (campaign/library names, icon identifiers)', () => {
        const config = site();
        config.pages[0]!.components.push(
            {
                id: 'lead',
                type: 'leadForm',
                enabled: true,
                props: {
                    title: 'Talk to us',
                    audienceId: 'aud-1',
                    audienceName: 'Spring Campaign',
                    gateAudienceName: 'Brochure Leads',
                },
            } as never,
            {
                id: 'fg',
                type: 'featureGrid',
                enabled: true,
                props: {
                    libraryName: 'Streams Library',
                    features: [{ title: 'Expert mentors', iconName: 'GraduationCap' }],
                },
            } as never
        );
        const strings = collectSiteStrings(config);
        expect(strings).toContain('Talk to us');
        expect(strings).toContain('Expert mentors');
        for (const hidden of ['Spring Campaign', 'Brochure Leads', 'Streams Library', 'GraduationCap'])
            expect(strings).not.toContain(hidden);
        // The same text where a visitor does read it still counts.
        config.pages[0]!.components.push({
            id: 'b',
            type: 'ctaBanner',
            enabled: true,
            props: { text: 'Spring Campaign' },
        } as never);
        expect(collectSiteStrings(config)).toContain('Spring Campaign');
    });
});

describe('coverage', () => {
    it('counts translated texts per offered language, rounding the percentage down', () => {
        const config = site({
            enabled: true,
            locales: [
                { code: 'en', label: 'EN' },
                { code: 'hi', label: 'हिन्दी' },
                { code: 'mr', label: 'मराठी' },
            ],
            strings: { hi: { 'Smart Academy': 'स्मार्ट अकादमी', Courses: 'कोर्स' } },
        });
        const [hi, mr] = siteCoverage(config);
        expect(hi).toMatchObject({ code: 'hi', total: 6, translated: 2, percent: 33 });
        expect(hi!.missing).toContain('Join now');
        expect(mr).toMatchObject({ code: 'mr', total: 6, translated: 0, percent: 0 });
        expect(coverageOf([], undefined).percent).toBe(100);
        expect(coverageOf(['a', 'b', 'c'], { a: 'x', b: 'y' }).percent).toBe(66);
    });

    it('a text kept "same as English" counts as translated and is reported as kept', () => {
        const dict = keepAsBase({ Courses: 'कोर्स' }, ['Smart Academy']);
        expect(dict).toEqual({ Courses: 'कोर्स', 'Smart Academy': 'Smart Academy' });
        expect(isKeptAsBase(dict, 'Smart Academy')).toBe(true);
        expect(isKeptAsBase(dict, 'Courses')).toBe(false);
        expect(coverageOf(['Courses', 'Smart Academy'], dict).translated).toBe(2);
    });
});

describe('editing translations', () => {
    it('an inline edit sets the entry; empty or the base text itself removes it', () => {
        expect(setTranslation({}, 'Courses', 'कोर्स')).toEqual({ Courses: 'कोर्स' });
        expect(setTranslation({ Courses: 'कोर्स' }, 'Courses', '')).toEqual({});
        expect(setTranslation({ Courses: 'कोर्स' }, 'Courses', 'Courses')).toEqual({});
    });

    it('AI results equal to their source are returned as unchanged instead of being stored', () => {
        const { dict, unchanged } = mergeAiTranslations(
            { A: 'a' },
            { Courses: 'कोर्स', NEET: 'NEET', Empty: ' ' }
        );
        expect(dict).toEqual({ A: 'a', Courses: 'कोर्स' });
        expect(unchanged).toEqual(['NEET']);
    });
});

describe('batchForTranslation', () => {
    it('packs short texts by count and size, sends long ones alone and skips whole pasted pages', () => {
        const short = Array.from({ length: 45 }, (_, i) => `Text number ${i}`);
        const long = 'L'.repeat(3500);
        const huge = 'H'.repeat(40000);
        const { batches, tooLong } = batchForTranslation([
            ...short.slice(0, 10),
            long,
            ...short.slice(10),
            huge,
        ]);
        expect(tooLong).toEqual([huge]);
        expect(batches).toContainEqual([long]);
        const shortBatches = batches.filter((b) => b[0] !== long);
        expect(shortBatches.map((b) => b.length)).toEqual([40, 5]);
        expect(shortBatches.flat()).toEqual(short);
    });

    it('starts a new batch when the character budget would be exceeded', () => {
        const texts = ['a'.repeat(2500), 'b'.repeat(2500), 'c'.repeat(2500)];
        expect(batchForTranslation(texts).batches.map((b) => b.length)).toEqual([2, 1]);
    });
});

describe('live data texts', () => {
    it('takes course names, levels and the card description (HTML stripped like the learner card)', () => {
        const texts = courseTextsFromRows([
            {
                package_name: 'Vedic Maths',
                level_name: 'Beginner Hindi',
                course_html_description_html: '<p>Learn&nbsp;fast</p>',
            },
            {
                package_name: 'Vedic Maths',
                level_name: 'Beginner Hindi',
                course_html_description_html: '',
            },
            { package_name: 'physics', level_name: null },
        ]);
        expect(texts).toEqual([
            { source: 'Vedic Maths', group: 'Course name' },
            { source: 'physics', group: 'Course name' },
            { source: 'Beginner Hindi', group: 'Level' },
            { source: 'Learn fast', group: 'Course description' },
        ]);
        expect(courseCardDescription('  <b>Hi</b> there ')).toBe('Hi there');
    });

    it('walks folders (title, subtitle, tagline, description, call to action), skipping hidden ones', () => {
        const node = (over: Partial<FolderNode>): FolderNode =>
            ({
                id: 'n',
                node_type: 'FOLDER',
                display_order: 0,
                status: 'ACTIVE',
                children: [],
                ...over,
            }) as FolderNode;
        const roots = [
            node({
                title: 'शिक्षा',
                subtitle: 'EDUCATION',
                tagline: 'Learn the Indian way of learning.',
                cta_label: 'Explore Education',
                children: [
                    node({ title: 'Vedic Maths', description: 'Numbers, the old way' }),
                    node({ title: 'Secret', status: 'HIDDEN' }),
                ],
            }),
        ];
        expect(folderTextsFromNodes(roots).map((t) => t.source)).toEqual([
            'शिक्षा',
            'EDUCATION',
            'Learn the Indian way of learning.',
            'Explore Education',
            'Vedic Maths',
            'Numbers, the old way',
        ]);
    });

    it('keeps free text, drops blanks, links and pure numbers, and dedupes', () => {
        expect(isLiveText('physics')).toBe(true);
        expect(isLiveText('Class 10')).toBe(true);
        expect(isLiveText('  ')).toBe(false);
        expect(isLiveText('https://x.org')).toBe(false);
        expect(isLiveText('1,599')).toBe(false);
        expect(
            dedupeLiveTexts([
                { source: 'A', group: 'Folder' },
                { source: 'A', group: 'Product page' },
            ])
        ).toEqual([{ source: 'A', group: 'Folder' }]);
    });
});
