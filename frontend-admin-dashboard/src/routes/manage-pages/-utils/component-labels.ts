/**
 * Human names for component types — the SINGLE source for every admin surface
 * that shows one: the insert palette, the Layers panel, and the canvas
 * selection badge.
 *
 * These three each used to derive their own label. The palette and the canvas
 * fell back to the raw camelCase type, so the same section appeared as
 * "Program Blocks" in Layers, "detail Blocks" in the palette and "detailBlocks"
 * on the canvas — leaving an admin unable to tell what kind of section they had
 * selected.
 *
 * Only types whose type name is not already the product name need an entry; the
 * fallback splits camelCase and capitalises.
 */
export const COMPONENT_LABELS: Record<string, string> = {
    header: 'Header',
    footer: 'Footer',
    heroSection: 'Hero Section',
    detailBlocks: 'Program Blocks',
    featureGrid: 'Feature Grid',
    courseCatalog: 'Course Catalog',
    bookCatalogue: 'Book Catalogue',
    productPageOffer: 'Product Page Offer',
    productCourseGrid: 'Course Grid (full catalogue)',
    mediaShowcase: 'Media Showcase',
    statsHighlights: 'Stats',
    testimonialSection: 'Testimonials',
    cartComponent: 'Cart',
    buyRentSection: 'Buy / Rent',
    policyRenderer: 'Policy',
    courseDetails: 'Course Details',
    bookDetails: 'Book Details',
    faqSection: 'FAQ',
    videoEmbed: 'Video Embed',
    ctaBanner: 'CTA Banner',
    pricingTable: 'Pricing Table',
    contactForm: 'Contact Form',
    teamSection: 'Team',
    announcementFeed: 'Announcements',
    imageGallery: 'Image Gallery',
    columnLayout: 'Column Layout',
    htmlBlock: 'Custom HTML',
    newsletterSignup: 'Newsletter Signup',
    stepsProcess: 'Steps / Process',
    logoCloud: 'Logo Cloud',
    tabsAccordion: 'Tabs / Accordion',
    mapEmbed: 'Map Embed',
    countdownTimer: 'Countdown Timer',
    textBlock: 'Text Block',
    imageBlock: 'Image Block',
    buttonBlock: 'Button',
    sectionHeading: 'Section Heading',
};

/** Friendly name for a component type, with a camelCase fallback. */
export const componentLabel = (type: string): string =>
    COMPONENT_LABELS[type] ??
    String(type || '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
