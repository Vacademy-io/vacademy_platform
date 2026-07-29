import { v4 as uuidv4 } from 'uuid';
import { Page, Component } from '../-types/editor-types';
import { componentTemplates } from './component-templates';

// Helper to create a component from a template with a fresh ID
const makeComponent = (type: string, overrides?: Partial<Component>): Component => ({
    id: uuidv4(),
    type,
    enabled: true,
    ...componentTemplates[type],
    ...overrides,
    props: {
        ...componentTemplates[type]?.props,
        ...overrides?.props,
    },
});

export interface PageTemplate {
    id: string;
    name: string;
    description: string;
    category: 'page' | 'section';
    getComponents: () => Component[];
}

export const PAGE_TEMPLATES: PageTemplate[] = [
    // ─────────── FULL PAGE TEMPLATES ───────────
    {
        id: 'landing-page',
        name: 'Landing Page',
        description: 'Header + Hero + Stats + Course Catalog + Testimonials + Footer',
        category: 'page',
        getComponents: () => [
            makeComponent('header'),
            makeComponent('heroSection', {
                props: {
                    ...componentTemplates['heroSection']?.props,
                    layout: 'split',
                    left: {
                        title: 'Learn Something New Today',
                        description: 'Join thousands of learners and unlock your potential.',
                        button: { enabled: true, text: 'Browse Courses', action: 'navigate', target: 'courses' },
                    },
                },
            }),
            makeComponent('statsHighlights'),
            makeComponent('courseCatalog'),
            makeComponent('testimonialSection'),
            makeComponent('footer'),
        ],
    },
    {
        id: 'course-landing',
        name: 'Course Landing',
        description: 'Header + Hero (course-focused) + Course Catalog + Buy/Rent + Footer',
        category: 'page',
        getComponents: () => [
            makeComponent('header'),
            makeComponent('heroSection', {
                props: {
                    ...componentTemplates['heroSection']?.props,
                    layout: 'centered',
                    left: {
                        title: 'Master Your Skills',
                        description: 'Expert-led courses with lifetime access.',
                        button: { enabled: true, text: 'Explore Courses', action: 'navigate', target: 'courses' },
                    },
                },
            }),
            makeComponent('courseCatalog'),
            makeComponent('buyRentSection'),
            makeComponent('footer'),
        ],
    },
    {
        id: 'about-page',
        name: 'About Page',
        description: 'Header + Hero + Stats + Testimonials + Footer',
        category: 'page',
        getComponents: () => [
            makeComponent('header'),
            makeComponent('heroSection', {
                props: {
                    ...componentTemplates['heroSection']?.props,
                    layout: 'centered',
                    left: {
                        title: 'About Us',
                        description: 'We help learners achieve their goals through quality education.',
                        button: { enabled: false, text: '', action: 'navigate', target: '' },
                    },
                },
            }),
            makeComponent('statsHighlights'),
            makeComponent('testimonialSection'),
            makeComponent('footer'),
        ],
    },
    {
        id: 'book-store',
        name: 'Book Store',
        description: 'Header + Hero + Book Catalog + Footer',
        category: 'page',
        getComponents: () => [
            makeComponent('header'),
            makeComponent('heroSection'),
            makeComponent('bookCatalogue'),
            makeComponent('footer'),
        ],
    },

    // ─────────── SECTION TEMPLATES ───────────
    {
        id: 'hero-centered',
        name: 'Hero (Centered)',
        description: 'Fullscreen centered hero section',
        category: 'section',
        getComponents: () => [
            makeComponent('heroSection', {
                props: {
                    ...componentTemplates['heroSection']?.props,
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
        getComponents: () => [
            makeComponent('statsHighlights'),
            makeComponent('testimonialSection'),
        ],
    },
    {
        id: 'course-showcase',
        name: 'Course Showcase',
        description: 'Course grid catalog section',
        category: 'section',
        getComponents: () => [
            makeComponent('courseCatalog'),
        ],
    },
    {
        id: 'media-carousel',
        name: 'Media Carousel',
        description: 'Sliding image/video showcase',
        category: 'section',
        getComponents: () => [
            makeComponent('mediaShowcase'),
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
        getComponents: () => [
            makeComponent('marquee'),
            makeComponent('heroSection', {
                props: {
                    ...componentTemplates['heroSection']?.props,
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
            makeComponent('statsHighlights'),
            makeComponent('sectionHeading', {
                props: { ...componentTemplates['sectionHeading']?.props, eyebrow: 'Why us', title: 'Built around how students actually learn' },
            }),
            makeComponent('featureGrid'),
            makeComponent('sectionHeading', {
                props: { ...componentTemplates['sectionHeading']?.props, eyebrow: 'Our programs', title: 'Every batch, in detail' },
            }),
            makeComponent('detailBlocks'),
            makeComponent('testimonialSection'),
            makeComponent('leadForm', {
                props: {
                    ...componentTemplates['leadForm']?.props,
                    title: 'Book your free demo class',
                    subtitle: 'Tell us your class and we will call you back today.',
                },
            }),
            makeComponent('faqSection'),
            makeComponent('ctaBanner'),
        ],
    },
    {
        id: 'programs-directory',
        name: 'Programs Directory',
        description: 'Compact header + one detailed block per programme + CTA (no prices)',
        category: 'page',
        getComponents: () => [
            makeComponent('sectionHeading', {
                props: {
                    ...componentTemplates['sectionHeading']?.props,
                    eyebrow: 'Everything we teach',
                    title: 'All our programs, in full detail',
                    lead: 'What each program covers, who it is for, and how it runs.',
                },
            }),
            makeComponent('detailBlocks'),
            makeComponent('ctaBanner'),
        ],
    },
    {
        id: 'enquiry-page',
        name: 'Enquiry / Contact',
        description: 'Campaign enquiry form + contact details + map',
        category: 'page',
        getComponents: () => [
            makeComponent('sectionHeading', {
                props: {
                    ...componentTemplates['sectionHeading']?.props,
                    eyebrow: 'Talk to us',
                    title: 'Ask us anything',
                    lead: 'Fill this in and our counsellors will get back to you.',
                },
            }),
            makeComponent('leadForm'),
            makeComponent('contactForm'),
            makeComponent('mapEmbed'),
        ],
    },
    {
        id: 'programs-section',
        name: 'Programme Blocks',
        description: 'Heading + one detailed block per programme',
        category: 'section',
        getComponents: () => [
            makeComponent('sectionHeading', {
                props: { ...componentTemplates['sectionHeading']?.props, eyebrow: 'Our programs', title: 'What we offer' },
            }),
            makeComponent('detailBlocks'),
        ],
    },
    {
        id: 'enquiry-section',
        name: 'Enquiry Form',
        description: 'A campaign-backed lead form section',
        category: 'section',
        getComponents: () => [makeComponent('leadForm')],
    },
    {
        id: 'lead-hero',
        name: 'Lead Hero',
        description: 'Hero + Stats to drive lead capture',
        category: 'section',
        getComponents: () => [
            makeComponent('heroSection'),
            makeComponent('statsHighlights'),
        ],
    },
];

/** Apply a template to a page: replaces all components */
export const applyPageTemplate = (page: Page, template: PageTemplate): Page => ({
    ...page,
    components: template.getComponents(),
});

/** Apply a section template: inserts components before footer (or at end) */
export const applySectionTemplate = (page: Page, template: PageTemplate): Page => {
    const footerIndex = page.components.findIndex((c) => c.type === 'footer');
    const newComponents = template.getComponents();
    if (footerIndex >= 0) {
        const updated = [...page.components];
        updated.splice(footerIndex, 0, ...newComponents);
        return { ...page, components: updated };
    }
    return { ...page, components: [...page.components, ...newComponents] };
};
