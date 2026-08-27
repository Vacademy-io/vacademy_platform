import { v4 as uuidv4 } from 'uuid';
import type { TFunction } from 'i18next';
import { Component } from '../-types/editor-types';

/**
 * Default prop values for every draggable page-builder component. These are
 * what a user actually sees the first time they add a component to a page —
 * before they customize it — so the prose (titles, descriptions, button
 * labels, etc.) is translated. Structural/technical values (type ids, CSS
 * colors, layout/style enums, field-mapping keys like `level_name`, filter
 * *values* that are matched against real data like `levelFilterValue`) stay
 * as literal strings — translating those would change behavior, not just
 * display.
 */
export const buildComponentTemplates = (t: TFunction): Record<string, Omit<Component, 'id'>> => ({
    header: {
        type: 'header',
        enabled: true,
        props: {
            logo: '',
            title: t('header.title'),
            backgroundColor: '#4F46E5', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            // Nav items use `route` (the learner header resolves it against the
            // catalogue), NOT `url`.
            navigation: [
                { label: t('header.navHome'), route: '', openInSameTab: true },
                { label: t('header.navCourses'), route: 'courses', openInSameTab: true },
            ],
            // authLinks is what the learner header ACTUALLY renders on the right
            // (login / signup / Get Started / campaign-form popups). `ctaButton`
            // was the legacy shape and is dead in the renderer — it stayed in
            // this template long after, so AI-composed headers taught the wrong
            // field and produced headers with no working buttons.
            authLinks: [
                { label: t('header.authLogin'), route: 'login' },
            ],
        },
    },

    heroSection: {
        type: 'heroSection',
        enabled: true,
        props: {
            layout: 'split',
            backgroundColor: '#F8FAFC', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
            eyebrow: { text: t('heroSection.eyebrow'), style: 'badge' },
            left: {
                title: t('heroSection.title'),
                subheading: t('heroSection.subheading'),
                description: t('heroSection.description'),
                tags: [t('heroSection.tagOnline'), t('heroSection.tagSelfPaced'), t('heroSection.tagCertified')],
                button: {
                    enabled: true,
                    text: t('heroSection.exploreCoursesButton'),
                    action: 'navigate',
                    target: '#courses',
                },
                buttons: [
                    { text: t('heroSection.exploreCoursesButton'), action: 'navigate', target: '#courses', variant: 'primary' },
                    { text: t('heroSection.talkToUsButton'), action: 'openLeadCollection', variant: 'secondary' },
                ],
            },
            statChips: [
                { value: '10,000+', label: t('heroSection.statLearnersLabel') },
                { value: '4.8/5', label: t('heroSection.statRatingLabel') },
            ],
            right: { image: '', alt: t('heroSection.heroImageAlt'), imageCollage: [] },
            styles: { padding: '40px', roundedEdges: true, textAlign: 'left' },
        },
    },

    courseCatalog: {
        type: 'courseCatalog',
        enabled: true,
        props: {
            title: t('courseCatalog.title'),
            showFilters: true,
            filtersConfig: [{ id: 'level', label: t('courseCatalog.filterLevelLabel'), type: 'checkbox', field: 'level_name' }],
            render: {
                layout: 'grid',
                cardFields: ['package_name', 'course_preview_image_media_id', 'price'],
                styles: {
                    hoverEffect: 'shadow',
                    roundedEdges: true,
                    backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
                },
            },
        },
    },

    footer: {
        type: 'footer',
        enabled: true,
        props: {
            layout: 'two-column',
            backgroundColor: '#F9FAFB', // design-lint-ignore: page-builder template default color
            textColor: '#374151', // design-lint-ignore: page-builder template default color
            leftSection: {
                title: t('footer.leftTitle'),
                text: t('footer.leftText'),
                socials: [],
            },
            rightSection: { title: t('footer.rightTitle'), links: [] },
            bottomNote: '© 2025',
        },
    },

    // ── Layout containers ────────────────────────────────────────────────────
    columnLayout2: {
        type: 'columnLayout',
        enabled: true,
        props: {
            columns: 2,
            columnWidths: ['1/2', '1/2'],
            gap: 'md',
            align: 'top',
            stackOnMobile: true,
            slots: [[], []],
        },
    },
    columnLayout2asymLeft: {
        type: 'columnLayout',
        enabled: true,
        props: {
            columns: 2,
            columnWidths: ['1/3', '2/3'],
            gap: 'md',
            align: 'top',
            stackOnMobile: true,
            slots: [[], []],
        },
    },
    columnLayout3: {
        type: 'columnLayout',
        enabled: true,
        props: {
            columns: 3,
            columnWidths: ['1/3', '1/3', '1/3'],
            gap: 'md',
            align: 'top',
            stackOnMobile: true,
            slots: [[], [], []],
        },
    },
    columnLayout4: {
        type: 'columnLayout',
        enabled: true,
        props: {
            columns: 4,
            columnWidths: ['1/4', '1/4', '1/4', '1/4'],
            gap: 'md',
            align: 'top',
            stackOnMobile: true,
            slots: [[], [], [], []],
        },
    },
    // ────────────────────────────────────────────────────────────────────────

    mediaShowcase: {
        type: 'mediaShowcase',
        enabled: true,
        props: {
            headerText: t('mediaShowcase.headerText'),
            description: t('mediaShowcase.description'),
            media: [],
            layout: 'carousel',
            styles: { backgroundColor: '#F0F9FF', roundedEdges: true }, // design-lint-ignore: page-builder template default color
        },
    },

    statsHighlights: {
        type: 'statsHighlights',
        enabled: true,
        props: {
            headerText: t('statsHighlights.headerText'),
            description: t('statsHighlights.description'),
            stats: [{ label: t('statsHighlights.statStudentsLabel'), value: '100+' }],
            style: 'circle',
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
            styles: { backgroundColor: '#FFFFFF', textColor: '#111827', hoverEffect: 'scale' }, // design-lint-ignore: page-builder template default color
        },
    },

    testimonialSection: {
        type: 'testimonialSection',
        enabled: true,
        props: {
            headerText: t('testimonialSection.headerText'),
            description: t('testimonialSection.description'),
            layout: 'grid-scroll',
            testimonials: [],
            backgroundColor: '#F9FAFB', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
            styles: {
                backgroundColor: '#F9FAFB', // design-lint-ignore: page-builder template default color
                roundedEdges: true,
                cardHoverEffect: 'lift',
                scrollEnabled: true,
            },
        },
    },

    bookCatalogue: {
        type: 'bookCatalogue',
        enabled: true,
        props: {
            title: t('bookCatalogue.title'),
            showFilters: true,
            filtersConfig: [],
            cartButtonConfig: { enabled: true, showAddToCartButton: true },
            render: {
                layout: 'grid',
                cardFields: [],
                styles: { hoverEffect: 'shadow', roundedEdges: true },
            },
        },
    },

    bookDetails: {
        type: 'bookDetails',
        enabled: true,
        props: {
            showEnquiry: true,
            showPayment: true,
            fields: { title: 'package_name', price: 'price' },
            showAddToCart: true,
        },
    },

    cartComponent: {
        type: 'cartComponent',
        enabled: true,
        props: {
            showItemImage: true,
            showItemTitle: true,
            showPrice: true,
            showEmptyState: true,
            styles: { padding: '10px' },
        },
    },

    buyRentSection: {
        type: 'buyRentSection',
        enabled: true,
        props: {
            heading: t('buyRentSection.heading'),
            // `levelFilterValue` is matched against real course data (the
            // `level_name` field) — it must stay in the data's own language,
            // NOT the admin UI's language, so only `buttonLabel` is translated.
            buy: { buttonLabel: t('buyRentSection.buyButtonLabel'), levelFilterValue: 'Buy', targetRoute: 'homepage' },
            rent: { buttonLabel: t('buyRentSection.rentButtonLabel'), levelFilterValue: 'Rent', targetRoute: 'homepage' },
        },
    },

    policyRenderer: {
        type: 'policyRenderer',
        enabled: true,
        props: {
            policies: {
                shipping: { title: t('policyRenderer.shippingTitle'), content: t('policyRenderer.shippingContent') },
            },
        },
    },

    courseDetails: {
        type: 'courseDetails',
        enabled: true,
        props: {
            showEnquiry: true,
            fields: { title: 'package_name', price: 'price' },
        },
    },

    faqSection: {
        type: 'faqSection',
        enabled: true,
        props: {
            headerText: t('faqSection.headerText'),
            subheading: t('faqSection.subheading'),
            faqs: [
                { question: t('faqSection.faq1Question'), answer: t('faqSection.faq1Answer') },
                { question: t('faqSection.faq2Question'), answer: t('faqSection.faq2Answer') },
                { question: t('faqSection.faq3Question'), answer: t('faqSection.faq3Answer') },
            ],
            backgroundColor: '#F9FAFB', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
        },
    },

    videoEmbed: {
        type: 'videoEmbed',
        enabled: true,
        props: {
            url: '',
            title: t('videoEmbed.title'),
            caption: '',
            aspectRatio: '16:9',
            autoplay: false,
            backgroundColor: '#000000', // design-lint-ignore: page-builder template default color
        },
    },

    ctaBanner: {
        type: 'ctaBanner',
        enabled: true,
        props: {
            heading: t('ctaBanner.heading'),
            subheading: t('ctaBanner.subheading'),
            backgroundColor: '#3B82F6', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            layout: 'centered',
            button: {
                enabled: true,
                text: t('ctaBanner.buttonText'),
                action: 'navigate',
                target: '',
                style: 'white',
            },
        },
    },

    pricingTable: {
        type: 'pricingTable',
        enabled: true,
        props: {
            headerText: t('pricingTable.headerText'),
            subheading: t('pricingTable.subheading'),
            plans: [
                {
                    name: t('pricingTable.basicName'),
                    price: t('pricingTable.basicPrice'),
                    period: '',
                    description: t('pricingTable.basicDescription'),
                    features: [t('pricingTable.basicFeature1'), t('pricingTable.basicFeature2'), t('pricingTable.basicFeature3')],
                    highlighted: false,
                    buttonText: t('pricingTable.basicButtonText'),
                    buttonTarget: '',
                },
                {
                    name: t('pricingTable.proName'),
                    // Currency amount — not translated; a real currency/locale
                    // formatting story is a separate feature.
                    price: '₹999',
                    period: t('pricingTable.proPeriod'),
                    description: t('pricingTable.proDescription'),
                    features: [
                        t('pricingTable.proFeature1'),
                        t('pricingTable.proFeature2'),
                        t('pricingTable.proFeature3'),
                        t('pricingTable.proFeature4'),
                    ],
                    highlighted: true,
                    buttonText: t('pricingTable.proButtonText'),
                    buttonTarget: '',
                },
            ],
        },
    },

    // An Audience campaign's registration form embedded on the page. Only the
    // campaign id is stored — fields/options/mandatory flags live on the
    // campaign in Audience Manager and are fetched live, so one definition
    // serves every placement (inline section, popup, /audience-response page).
    leadForm: {
        type: 'leadForm',
        enabled: true,
        props: {
            audienceId: '',
            audienceName: '',
            title: t('leadForm.title'),
            subtitle: t('leadForm.subtitle'),
            submitLabel: t('leadForm.submitLabel'),
            successMessage: t('leadForm.successMessage'),
            layout: 'card',
            align: 'center',
        },
    },

    contactForm: {
        type: 'contactForm',
        enabled: true,
        props: {
            heading: t('contactForm.heading'),
            subheading: t('contactForm.subheading'),
            fields: [
                { name: 'name', label: t('contactForm.nameLabel'), type: 'text', required: true },
                { name: 'email', label: t('contactForm.emailLabel'), type: 'email', required: true },
                { name: 'phone', label: t('contactForm.phoneLabel'), type: 'text', required: false },
                { name: 'message', label: t('contactForm.messageLabel'), type: 'textarea', required: true },
            ],
            submitLabel: t('contactForm.submitLabel'),
            successMessage: t('contactForm.successMessage'),
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            // Destination campaign (Audience Manager). Empty = the auto
            // "Course Catalogue Leads" list.
            audienceId: '',
            audienceName: '',
        },
    },

    teamSection: {
        type: 'teamSection',
        enabled: true,
        props: {
            headerText: t('teamSection.headerText'),
            subheading: t('teamSection.subheading'),
            members: [
                {
                    name: t('teamSection.member1Name'),
                    role: t('teamSection.member1Role'),
                    bio: t('teamSection.member1Bio'),
                    avatar: '',
                    socials: [],
                },
                {
                    name: t('teamSection.member2Name'),
                    role: t('teamSection.member2Role'),
                    bio: t('teamSection.member2Bio'),
                    avatar: '',
                    socials: [],
                },
            ],
            layout: 'grid',
            columns: 3,
        },
    },

    announcementFeed: {
        type: 'announcementFeed',
        enabled: true,
        props: {
            headerText: t('announcementFeed.headerText'),
            subheading: t('announcementFeed.subheading'),
            announcements: [
                {
                    title: t('announcementFeed.item1Title'),
                    date: '2025-01-15',
                    summary: t('announcementFeed.item1Summary'),
                    tag: t('announcementFeed.item1Tag'),
                },
                {
                    title: t('announcementFeed.item2Title'),
                    date: '2025-01-10',
                    summary: t('announcementFeed.item2Summary'),
                    tag: t('announcementFeed.item2Tag'),
                },
            ],
            layout: 'list',
            showDate: true,
            showTag: true,
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
        },
    },

    imageGallery: {
        type: 'imageGallery',
        enabled: true,
        props: {
            headerText: t('imageGallery.headerText'),
            subheading: '',
            images: [
                { src: '', alt: t('imageGallery.image1Alt'), caption: '' },
                { src: '', alt: t('imageGallery.image2Alt'), caption: '' },
                { src: '', alt: t('imageGallery.image3Alt'), caption: '' },
            ],
            columns: 3,
            gap: 'medium',
            showCaptions: false,
        },
    },
    spacer: {
        type: 'spacer',
        enabled: true,
        props: {
            height: '48px',
            showDivider: false,
            dividerStyle: 'solid',
            dividerColor: '#E5E7EB', // design-lint-ignore: page-builder template default color
            dividerWidth: '1px',
            maxWidth: '100%',
        },
    },

    tabsAccordion: {
        type: 'tabsAccordion',
        enabled: true,
        props: {
            mode: 'tabs',
            items: [
                { title: t('tabsAccordion.tab1Title'), content: t('tabsAccordion.tab1Content') },
                { title: t('tabsAccordion.tab2Title'), content: t('tabsAccordion.tab2Content') },
                { title: t('tabsAccordion.tab3Title'), content: t('tabsAccordion.tab3Content') },
            ],
            defaultOpen: 0,
            allowMultiple: false,
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
        },
    },

    logoCloud: {
        type: 'logoCloud',
        enabled: true,
        props: {
            headerText: t('logoCloud.headerText'),
            subheading: '',
            logos: [],
            layout: 'grid',
            grayscale: true,
            columns: 5,
            display: 'logo',
            tile: 'none',
            marqueeSpeed: 'medium',
            logoHeight: 'md',
        },
    },

    trustChip: {
        type: 'trustChip',
        enabled: true,
        props: {
            text: t('trustChip.text'),
            rating: 4.8,
            avatars: [],
            alignment: 'center',
        },
    },

    sectionHeading: {
        type: 'sectionHeading',
        enabled: true,
        props: {
            eyebrow: t('sectionHeading.eyebrow'),
            title: t('sectionHeading.title'),
            highlight: { text: t('sectionHeading.highlight'), style: 'gradient' },
            lead: t('sectionHeading.lead'),
            align: 'center',
            size: 'lg',
        },
    },

    mapEmbed: {
        type: 'mapEmbed',
        enabled: true,
        props: {
            embedUrl: '',
            height: '400px',
            borderRadius: '8px',
            title: t('mapEmbed.title'),
        },
    },

    countdownTimer: {
        type: 'countdownTimer',
        enabled: true,
        props: {
            targetDate: '',
            heading: t('countdownTimer.heading'),
            expiredMessage: t('countdownTimer.expiredMessage'),
            backgroundColor: '#1E293B', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            style: 'cards',
        },
    },
    textBlock: {
        type: 'textBlock',
        enabled: true,
        props: {
            content: t('textBlock.content'),
            maxWidth: '800px',
            alignment: 'center',
        },
    },

    // Editorial "spec sheet": ONE dense block per thing being documented, with a
    // hairline detail table and a label/value spec strip. This is the reference /
    // directory counterpart to featureGrid's marketing cards — use it when the
    // page's job is to DOCUMENT offerings rather than sell them. It deliberately
    // has no price/image/enrol props, so it can never render a commerce surface.
    detailBlocks: {
        type: 'detailBlocks',
        enabled: true,
        props: {
            headerText: '',
            subheading: '',
            columns: 3,
            specColumns: 4,
            blocks: [
                {
                    anchor: 'flagship-program',
                    tag: t('detailBlocks.block1Tag'),
                    headerVariant: 'solid',
                    title: t('detailBlocks.block1Title'),
                    description: t('detailBlocks.block1Description'),
                    items: [
                        { title: t('detailBlocks.block1Item1Title'), description: t('detailBlocks.block1Item1Description') },
                        { title: t('detailBlocks.block1Item2Title'), description: t('detailBlocks.block1Item2Description') },
                        { title: t('detailBlocks.block1Item3Title'), description: t('detailBlocks.block1Item3Description') },
                    ],
                    specs: [
                        { label: t('detailBlocks.block1Spec1Label'), value: t('detailBlocks.block1Spec1Value') },
                        { label: t('detailBlocks.block1Spec2Label'), value: t('detailBlocks.block1Spec2Value') },
                        { label: t('detailBlocks.block1Spec3Label'), value: t('detailBlocks.block1Spec3Value') },
                        { label: t('detailBlocks.block1Spec4Label'), value: t('detailBlocks.block1Spec4Value') },
                    ],
                    note: t('detailBlocks.block1Note'),
                    noteTone: 'warn',
                },
                {
                    anchor: 'second-program',
                    tag: t('detailBlocks.block2Tag'),
                    title: t('detailBlocks.block2Title'),
                    description: t('detailBlocks.block2Description'),
                    items: [
                        { title: t('detailBlocks.block2Item1Title'), description: t('detailBlocks.block2Item1Description') },
                        { title: t('detailBlocks.block2Item2Title'), description: t('detailBlocks.block2Item2Description') },
                    ],
                    specs: [
                        { label: t('detailBlocks.block2Spec1Label'), value: t('detailBlocks.block2Spec1Value') },
                        { label: t('detailBlocks.block2Spec2Label'), value: t('detailBlocks.block2Spec2Value') },
                    ],
                },
            ],
        },
    },

    featureGrid: {
        type: 'featureGrid',
        enabled: true,
        props: {
            headerText: t('featureGrid.headerText'),
            subheading: t('featureGrid.subheading'),
            columns: 3,
            features: [
                // style 'cards'/'glass'/'tinted': icon + title + description (+ optional chips/bullets).
                { iconName: 'GraduationCap', title: t('featureGrid.feature1Title'), description: t('featureGrid.feature1Description'), chips: [t('featureGrid.feature1Chip1')] },
                { iconName: 'BookOpen', title: t('featureGrid.feature2Title'), description: t('featureGrid.feature2Description') },
                { iconName: 'Trophy', title: t('featureGrid.feature3Title'), description: t('featureGrid.feature3Description') },
                // style 'panel' (divisions/comparison): a card = tinted header
                // {badge, iconName, title, description, headerVariant 'solid'|'tint'
                // or headerColor '#rrggbb'} over a body of `bullets`. Make one
                // pillar headerVariant 'solid' to stand out.
                {
                    badge: t('featureGrid.feature4Badge'), iconName: 'GraduationCap', headerVariant: 'solid',
                    title: t('featureGrid.feature4Title'), description: t('featureGrid.feature4Description'),
                    bullets: [t('featureGrid.feature4Bullet1'), t('featureGrid.feature4Bullet2'), t('featureGrid.feature4Bullet3')],
                },
            ],
            style: 'cards',
            iconSize: 'large',
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
        },
    },

    imageBlock: {
        type: 'imageBlock',
        enabled: true,
        props: {
            src: '',
            alt: t('imageBlock.alt'),
            caption: '',
            linkUrl: '',
            linkTarget: '_blank',
            alignment: 'center',
            maxWidth: '100%',
            borderRadius: '8px',
            aspectRatio: 'auto',
        },
    },

    buttonBlock: {
        type: 'buttonBlock',
        enabled: true,
        props: {
            text: t('buttonBlock.text'),
            url: '',
            target: '_self',
            variant: 'filled',
            size: 'large',
            alignment: 'center',
            backgroundColor: '',
            textColor: '',
            borderRadius: '8px',
            fullWidth: false,
            // 'link' navigates; 'openForm' opens the campaign's form as a popup.
            action: 'link',
            audienceId: '',
            formTitle: '',
        },
    },

    newsletterSignup: {
        type: 'newsletterSignup',
        enabled: true,
        props: {
            heading: t('newsletterSignup.heading'),
            subheading: t('newsletterSignup.subheading'),
            placeholder: t('newsletterSignup.placeholder'),
            buttonText: t('newsletterSignup.buttonText'),
            layout: 'inline',
            backgroundColor: '#F8FAFC', // design-lint-ignore: page-builder template default color
            successMessage: t('newsletterSignup.successMessage'),
            // Destination campaign (Audience Manager). Empty = the auto list.
            audienceId: '',
            audienceName: '',
        },
    },

    stepsProcess: {
        type: 'stepsProcess',
        enabled: true,
        props: {
            headerText: t('stepsProcess.headerText'),
            subheading: t('stepsProcess.subheading'),
            layout: 'horizontal',
            steps: [
                { number: '1', title: t('stepsProcess.step1Title'), description: t('stepsProcess.step1Description') },
                { number: '2', title: t('stepsProcess.step2Title'), description: t('stepsProcess.step2Description') },
                { number: '3', title: t('stepsProcess.step3Title'), description: t('stepsProcess.step3Description') },
            ],
            connectorStyle: 'line',
            backgroundColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            textColor: '#111827', // design-lint-ignore: page-builder template default color
            accentColor: '',
        },
    },
    marquee: {
        type: 'marquee',
        enabled: true,
        props: {
            items: [
                { icon: '⭐', text: t('marquee.item1Text') },
                { icon: '🎓', text: t('marquee.item2Text') },
                { icon: '🏆', text: t('marquee.item3Text') },
                { icon: '🚀', text: t('marquee.item4Text') },
                { icon: '💡', text: t('marquee.item5Text') },
            ],
            defaultIcon: '⭐',
            speed: 'medium',
            direction: 'left',
            pauseOnHover: true,
            backgroundColor: '#1e1b4b', // design-lint-ignore: page-builder template default color
            textColor: '#ffffff', // design-lint-ignore: page-builder template default color
            iconColor: '#facc15', // design-lint-ignore: page-builder template default color
            fontSize: 'sm',
        },
    },
    productCourseGrid: {
        type: 'productCourseGrid',
        enabled: true,
        props: {
            title: '',
            columns: 3,
            layout: 'grid',
            showPrice: true,
            showBadge: true,
            showFilters: true,
        },
    },

    // Surfaces a Product Page's sellable courses on a catalogue page and
    // deep-links each card into that page's cart. Only the CODE is stored —
    // the course list is read live, because a product-page save replaces all
    // of its invite mappings and any cached list would go stale.
    productPageOffer: {
        type: 'productPageOffer',
        enabled: true,
        props: {
            productPageCode: '',
            productPageName: '',
            title: t('productPageOffer.title'),
            subtitle: t('productPageOffer.subtitle'),
            columns: 3,
            // 'grid' wraps onto rows; 'carousel' is one swipeable horizontal row.
            layout: 'grid',
            // App-style rail header by default: left-aligned, compact type, with
            // a "See all" link into the product page. Existing saved pages have
            // no align/headerScale props and keep the old centered look.
            align: 'left',
            headerScale: 'md',
            showViewAll: true,
            viewAllLabel: t('productPageOffer.viewAllLabel'),
            ctaLabel: t('productPageOffer.ctaLabel'),
            // Multi-course basket. OFF by default so existing sections keep the
            // one-card-one-checkout behaviour; turned on, each card's CTA
            // becomes an add/remove toggle and a basket bar carries the whole
            // selection into the product page's cart in one go. Worth it when
            // a visitor normally buys several at once (Olympiad subjects,
            // a class's whole set of practice courses).
            enableCart: false,
            cartCtaLabel: t('productPageOffer.cartCtaLabel'),
            checkoutCtaLabel: t('productPageOffer.checkoutCtaLabel'),
            // Second CTA per card: browse the course details page first. Its
            // enrol button re-enters this product page's checkout, so both
            // paths converge on the same funnel.
            showViewCourse: true,
            viewCourseLabel: t('productPageOffer.viewCourseLabel'),
            showImage: true,
            showChips: true,
            showDescription: true,
            showValidity: true,
            showPrice: true,
            // Product pages can carry 150+ courses (book stores especially), so
            // paginate by default; 0 renders every course with no pager.
            pageSize: 9,
            // Only applies to a 'carousel' layout with pageSize 0 — how many
            // cards the row holds before it ends with a link to the product
            // page. 0 puts every course in the row.
            railMaxCards: 12,
            showSearch: true,
            scrollable: false,
            scrollMaxHeight: 640,
        },
    },

    htmlBlock: {
        type: 'htmlBlock',
        enabled: true,
        props: {
            html: '',
            css: '',
            prompt: '',
        },
    },
    /** A whole page pasted from elsewhere (ChatGPT/Claude, an agency, an old
     *  site). Rendered by renderHtmlPage: page-level caps, SVG allowed, action
     *  hooks bound. Never drag-and-dropped — a page is either an HTML page or a
     *  built page, so this is created by the "HTML page" option in Add Page and
     *  is the page's only component. Kept out of the AI composer's vocabulary
     *  (FORBIDDEN in the schema exporter) for the same reason. */
    htmlPage: {
        type: 'htmlPage',
        enabled: true,
        props: {
            html: '',
            css: '',
        },
    },
});

export const getComponentTemplate = (type: string, t: TFunction): Component => {
    const template = buildComponentTemplates(t)[type];
    if (!template) throw new Error(`Unknown component type: ${type}`);

    return {
        ...template,
        id: `${type}-${uuidv4().slice(0, 8)}`,
        props: JSON.parse(JSON.stringify(template.props)), // Deep copy props
    };
};
