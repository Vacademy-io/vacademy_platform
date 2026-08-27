import { v4 as uuidv4 } from 'uuid';
import type { TFunction } from 'i18next';
import { Page, Component } from '../-types/editor-types';
import { buildComponentTemplates } from './component-templates';

// Helper to create a component from a template with a fresh ID
const makeComponent = (t: TFunction, type: string, overrides?: Partial<Component>): Component => {
    const componentTemplates = buildComponentTemplates(t);
    return {
        id: uuidv4(),
        type,
        enabled: true,
        ...componentTemplates[type],
        ...overrides,
        props: {
            ...componentTemplates[type]?.props,
            ...overrides?.props,
        },
    };
};

export interface PageTemplate {
    id: string;
    name: string;
    description: string;
    category: 'page' | 'section';
    getComponents: (t: TFunction) => Component[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
    // ─────────── FULL PAGE TEMPLATES ───────────
    {
        id: 'landing-page',
        name: 'Landing Page',
        description: 'Header + Hero + Stats + Course Catalog + Testimonials + Footer',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'header'),
            makeComponent(t, 'heroSection', {
                props: {
                    ...buildComponentTemplates(t)['heroSection']?.props,
                    layout: 'split',
                    left: {
                        title: 'Learn Something New Today',
                        description: 'Join thousands of learners and unlock your potential.',
                        button: { enabled: true, text: 'Browse Courses', action: 'navigate', target: 'courses' },
                    },
                },
            }),
            makeComponent(t, 'statsHighlights'),
            makeComponent(t, 'courseCatalog'),
            makeComponent(t, 'testimonialSection'),
            makeComponent(t, 'footer'),
        ],
    },
    {
        id: 'course-landing',
        name: 'Course Landing',
        description: 'Header + Hero (course-focused) + Course Catalog + Buy/Rent + Footer',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'header'),
            makeComponent(t, 'heroSection', {
                props: {
                    ...buildComponentTemplates(t)['heroSection']?.props,
                    layout: 'centered',
                    left: {
                        title: 'Master Your Skills',
                        description: 'Expert-led courses with lifetime access.',
                        button: { enabled: true, text: 'Explore Courses', action: 'navigate', target: 'courses' },
                    },
                },
            }),
            makeComponent(t, 'courseCatalog'),
            makeComponent(t, 'buyRentSection'),
            makeComponent(t, 'footer'),
        ],
    },
    {
        id: 'about-page',
        name: 'About Page',
        description: 'Header + Hero + Stats + Testimonials + Footer',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'header'),
            makeComponent(t, 'heroSection', {
                props: {
                    ...buildComponentTemplates(t)['heroSection']?.props,
                    layout: 'centered',
                    left: {
                        title: 'About Us',
                        description: 'We help learners achieve their goals through quality education.',
                        button: { enabled: false, text: '', action: 'navigate', target: '' },
                    },
                },
            }),
            makeComponent(t, 'statsHighlights'),
            makeComponent(t, 'testimonialSection'),
            makeComponent(t, 'footer'),
        ],
    },
    {
        id: 'book-store',
        name: 'Book Store',
        description: 'Header + Hero + Book Catalog + Footer',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'header'),
            makeComponent(t, 'heroSection'),
            makeComponent(t, 'bookCatalogue'),
            makeComponent(t, 'footer'),
        ],
    },

    // ─────────── SECTION TEMPLATES ───────────
    {
        id: 'hero-centered',
        name: 'Hero (Centered)',
        description: 'Fullscreen centered hero section',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'heroSection', {
                props: {
                    ...buildComponentTemplates(t)['heroSection']?.props,
                    layout: 'centered',
                },
            }),
        ],
    },
    {
        id: 'social-proof',
        name: 'Social Proof',
        description: 'Stats + Testimonials block',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'statsHighlights'),
            makeComponent(t, 'testimonialSection'),
        ],
    },
    {
        id: 'course-showcase',
        name: 'Course Showcase',
        description: 'Course grid catalog section',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'courseCatalog'),
        ],
    },
    {
        id: 'media-carousel',
        name: 'Media Carousel',
        description: 'Sliding image/video showcase',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'mediaShowcase'),
        ],
    },
    // ── Niche kits ──────────────────────────────────────────────────────
    // These wire up the components a coaching/tuition site actually converts
    // with — dense programme blocks, a campaign-backed enquiry form, an
    // urgency ticker — rather than leaving an admin to discover them one by
    // one. Data-bound pieces (leadForm/productPageOffer) ship unset ON
    // PURPOSE: the admin picks their campaign / product page, and the
    // pre-publish check now tells them if they forget.
    {
        id: 'coaching-institute-home',
        name: 'Coaching Institute — Home',
        description: 'Announcement ticker + hero + why-us + programme blocks + enquiry form + FAQ + CTA',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'marquee'),
            makeComponent(t, 'heroSection', {
                props: {
                    ...buildComponentTemplates(t)['heroSection']?.props,
                    layout: 'split',
                    left: {
                        eyebrow: 'Admissions open',
                        title: 'Coaching that gets results',
                        description: 'Live, exam-focused classes taught by faculty who have taken the exam themselves.',
                        buttons: [
                            { text: 'Book a free demo', variant: 'primary', action: 'openForm', audienceId: '' },
                            { text: 'See our programs', variant: 'secondary', action: 'navigate', target: 'programs' },
                        ],
                    },
                },
            }),
            makeComponent(t, 'statsHighlights'),
            makeComponent(t, 'sectionHeading', {
                props: { ...buildComponentTemplates(t)['sectionHeading']?.props, eyebrow: 'Why us', title: 'Built around how students actually learn' },
            }),
            makeComponent(t, 'featureGrid'),
            makeComponent(t, 'sectionHeading', {
                props: { ...buildComponentTemplates(t)['sectionHeading']?.props, eyebrow: 'Our programs', title: 'Every batch, in detail' },
            }),
            makeComponent(t, 'detailBlocks'),
            makeComponent(t, 'testimonialSection'),
            makeComponent(t, 'leadForm', {
                props: {
                    ...buildComponentTemplates(t)['leadForm']?.props,
                    title: 'Book your free demo class',
                    subtitle: 'Tell us your class and we will call you back today.',
                },
            }),
            makeComponent(t, 'faqSection'),
            makeComponent(t, 'ctaBanner'),
        ],
    },
    {
        id: 'programs-directory',
        name: 'Programs Directory',
        description: 'Compact header + one detailed block per programme + CTA (no prices)',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'sectionHeading', {
                props: {
                    ...buildComponentTemplates(t)['sectionHeading']?.props,
                    eyebrow: 'Everything we teach',
                    title: 'All our programs, in full detail',
                    lead: 'What each program covers, who it is for, and how it runs.',
                },
            }),
            makeComponent(t, 'detailBlocks'),
            makeComponent(t, 'ctaBanner'),
        ],
    },
    {
        id: 'enquiry-page',
        name: 'Enquiry / Contact',
        description: 'Campaign enquiry form + contact details + map',
        category: 'page',
        getComponents: (t) => [
            makeComponent(t, 'sectionHeading', {
                props: {
                    ...buildComponentTemplates(t)['sectionHeading']?.props,
                    eyebrow: 'Talk to us',
                    title: 'Ask us anything',
                    lead: 'Fill this in and our counsellors will get back to you.',
                },
            }),
            makeComponent(t, 'leadForm'),
            makeComponent(t, 'contactForm'),
            makeComponent(t, 'mapEmbed'),
        ],
    },
    {
        id: 'programs-section',
        name: 'Programme Blocks',
        description: 'Heading + one detailed block per programme',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'sectionHeading', {
                props: { ...buildComponentTemplates(t)['sectionHeading']?.props, eyebrow: 'Our programs', title: 'What we offer' },
            }),
            makeComponent(t, 'detailBlocks'),
        ],
    },
    {
        id: 'enquiry-section',
        name: 'Enquiry Form',
        description: 'A campaign-backed lead form section',
        category: 'section',
        getComponents: (t) => [makeComponent(t, 'leadForm')],
    },
    {
        id: 'lead-hero',
        name: 'Lead Hero',
        description: 'Hero + Stats to drive lead capture',
        category: 'section',
        getComponents: (t) => [
            makeComponent(t, 'heroSection'),
            makeComponent(t, 'statsHighlights'),
        ],
    },
];

/** Apply a template to a page: replaces all components */
export const applyPageTemplate = (page: Page, template: PageTemplate, t: TFunction): Page => ({
    ...page,
    components: template.getComponents(t),
});

/** Apply a section template: inserts components before footer (or at end) */
export const applySectionTemplate = (page: Page, template: PageTemplate, t: TFunction): Page => {
    const footerIndex = page.components.findIndex((c) => c.type === 'footer');
    const newComponents = template.getComponents(t);
    if (footerIndex >= 0) {
        const updated = [...page.components];
        updated.splice(footerIndex, 0, ...newComponents);
        return { ...page, components: updated };
    }
    return { ...page, components: [...page.components, ...newComponents] };
};
