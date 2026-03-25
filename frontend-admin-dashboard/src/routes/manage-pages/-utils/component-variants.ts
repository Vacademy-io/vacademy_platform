/**
 * Preset layout variants for each component type.
 * Clicking a variant applies its props (merged with existing props) to the component.
 */

interface ComponentVariant {
    id: string;
    label: string;
    description: string;
    // ASCII art thumbnail for visual preview in the switcher
    thumbnail: string;
    // Partial props to merge into the component on apply
    props: Record<string, any>;
}

export const COMPONENT_VARIANTS: Record<string, ComponentVariant[]> = {
    heroSection: [
        {
            id: 'split-left',
            label: 'Split',
            description: 'Text left, image right',
            thumbnail: `┌────────────────────┐
│ Title   │  [Image] │
│ Desc    │          │
│ [CTA]   │          │
└────────────────────┘`,
            props: { layout: 'split' },
        },
        {
            id: 'centered',
            label: 'Centered',
            description: 'Text centered, image below',
            thumbnail: `┌────────────────────┐
│     Title          │
│     Description    │
│     [CTA]          │
│  ┌──────────────┐  │
│  │   [Image]    │  │
└────────────────────┘`,
            props: { layout: 'centered' },
        },
        {
            id: 'fullwidth',
            label: 'Full Width',
            description: 'Full-width banner with overlay text',
            thumbnail: `┌────────────────────┐
│ [Fullwidth Image]  │
│ Title     [CTA]    │
└────────────────────┘`,
            props: { layout: 'fullwidth' },
        },
    ],

    courseCatalog: [
        {
            id: 'grid-3',
            label: 'Grid 3',
            description: '3-column card grid',
            thumbnail: `┌────────────────────┐
│ [Card][Card][Card] │
│ [Card][Card][Card] │
└────────────────────┘`,
            props: { render: { layout: 'grid', columns: 3 } },
        },
        {
            id: 'grid-4',
            label: 'Grid 4',
            description: '4-column compact grid',
            thumbnail: `┌────────────────────┐
│ [C][C][C][C]       │
│ [C][C][C][C]       │
└────────────────────┘`,
            props: { render: { layout: 'grid', columns: 4 } },
        },
        {
            id: 'list',
            label: 'List',
            description: 'Horizontal list rows',
            thumbnail: `┌────────────────────┐
│ [Img] Title  Price │
│ [Img] Title  Price │
│ [Img] Title  Price │
└────────────────────┘`,
            props: { render: { layout: 'list' } },
        },
    ],

    bookCatalogue: [
        {
            id: 'grid-3',
            label: 'Grid 3',
            description: '3-column book grid',
            thumbnail: `┌────────────────────┐
│ [Bk] [Bk] [Bk]    │
└────────────────────┘`,
            props: { render: { layout: 'grid', columns: 3 } },
        },
        {
            id: 'list',
            label: 'List',
            description: 'Book list rows',
            thumbnail: `┌────────────────────┐
│ [Img] Book  Price  │
│ [Img] Book  Price  │
└────────────────────┘`,
            props: { render: { layout: 'list' } },
        },
    ],

    header: [
        {
            id: 'minimal',
            label: 'Minimal',
            description: 'Logo + title only',
            thumbnail: `┌────────────────────┐
│ [Logo] Platform    │
└────────────────────┘`,
            props: { style: 'minimal' },
        },
        {
            id: 'full-nav',
            label: 'Full Nav',
            description: 'Logo + navigation links + auth',
            thumbnail: `┌────────────────────┐
│ [Logo] Home About  │
│                Login│
└────────────────────┘`,
            props: { style: 'full-nav' },
        },
        {
            id: 'centered',
            label: 'Centered',
            description: 'Centered logo and nav',
            thumbnail: `┌────────────────────┐
│   [Logo] Platform  │
│  Home  About  Login│
└────────────────────┘`,
            props: { style: 'centered' },
        },
    ],

    footer: [
        {
            id: 'two-column',
            label: 'Two Col',
            description: 'Two-column footer',
            thumbnail: `┌────────────────────┐
│ Brand    │  Links  │
│ Desc     │         │
└────────────────────┘`,
            props: { layout: 'two-column' },
        },
        {
            id: 'three-column',
            label: 'Three Col',
            description: 'Three-column footer',
            thumbnail: `┌────────────────────┐
│ Brand│Links│Contact│
└────────────────────┘`,
            props: { layout: 'three-column' },
        },
        {
            id: 'four-column',
            label: 'Four Col',
            description: 'Four-column full footer',
            thumbnail: `┌────────────────────┐
│Br│Lk│Soc│Contact  │
└────────────────────┘`,
            props: { layout: 'four-column' },
        },
    ],

    mediaShowcase: [
        {
            id: 'carousel',
            label: 'Carousel',
            description: 'Sliding carousel layout',
            thumbnail: `┌────────────────────┐
│ ← [  Slide  ] →   │
└────────────────────┘`,
            props: { layout: 'carousel' },
        },
        {
            id: 'grid',
            label: 'Grid',
            description: 'Static media grid',
            thumbnail: `┌────────────────────┐
│ [M] [M] [M]       │
│ [M] [M] [M]       │
└────────────────────┘`,
            props: { layout: 'grid' },
        },
        {
            id: 'slider',
            label: 'Slider',
            description: 'Fullwidth slider',
            thumbnail: `┌────────────────────┐
│ [── Slide ──]      │
│   ● ○ ○ ○          │
└────────────────────┘`,
            props: { layout: 'slider' },
        },
    ],

    statsHighlights: [
        {
            id: 'grid-dark',
            label: 'Dark Grid',
            description: 'Dark background stat cards',
            thumbnail: `┌────────────────────┐
│ [1000+] [500+]     │
│ Students Courses   │
└────────────────────┘`,
            props: { style: 'dark' },
        },
        {
            id: 'grid-light',
            label: 'Light Grid',
            description: 'Light background stat cards',
            thumbnail: `┌────────────────────┐
│ [1000+] [500+]     │
│ Students Courses   │
└────────────────────┘`,
            props: { style: 'light' },
        },
    ],

    testimonialSection: [
        {
            id: 'grid',
            label: 'Grid',
            description: 'Testimonial cards in a grid',
            thumbnail: `┌────────────────────┐
│ [★★★] [★★★]       │
│ "Quote" "Quote"    │
└────────────────────┘`,
            props: { layout: 'grid' },
        },
        {
            id: 'scroll',
            label: 'Scroll',
            description: 'Horizontally scrollable cards',
            thumbnail: `┌────────────────────┐
│ [★][★][★][★] →    │
└────────────────────┘`,
            props: { layout: 'scroll' },
        },
    ],
};
