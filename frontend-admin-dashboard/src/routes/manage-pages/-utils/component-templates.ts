import { v4 as uuidv4 } from 'uuid';
import { Component } from '../-types/editor-types';

export const componentTemplates: Record<string, Omit<Component, 'id'>> = {
    header: {
        type: 'header',
        enabled: true,
        props: {
            logo: '',
            title: 'My Platform',
            backgroundColor: '#4F46E5', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            // Nav items use `route` (the learner header resolves it against the
            // catalogue), NOT `url`.
            navigation: [
                { label: 'Home', route: '', openInSameTab: true },
                { label: 'Courses', route: 'courses', openInSameTab: true },
            ],
            // authLinks is what the learner header ACTUALLY renders on the right
            // (login / signup / Get Started / campaign-form popups). `ctaButton`
            // was the legacy shape and is dead in the renderer — it stayed in
            // this template long after, so AI-composed headers taught the wrong
            // field and produced headers with no working buttons.
            authLinks: [
                { label: 'Login', route: 'login' },
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
            eyebrow: { text: 'New batch enrolling now', style: 'badge' },
            left: {
                title: 'Welcome to Our Platform',
                subheading: 'Your path to mastery starts here',
                description: '<p>Start your learning journey today with expert-led courses designed for real-world success.</p>',
                tags: ['Online', 'Self-paced', 'Certified'],
                button: {
                    enabled: true,
                    text: 'Explore Courses',
                    action: 'navigate',
                    target: '#courses',
                },
                buttons: [
                    { text: 'Explore Courses', action: 'navigate', target: '#courses', variant: 'primary' },
                    { text: 'Talk to Us', action: 'openLeadCollection', variant: 'secondary' },
                ],
            },
            statChips: [
                { value: '10,000+', label: 'Learners' },
                { value: '4.8/5', label: 'Average rating' },
            ],
            right: { image: '', alt: 'Hero image', imageCollage: [] },
            styles: { padding: '40px', roundedEdges: true, textAlign: 'left' },
        },
    },

    courseCatalog: {
        type: 'courseCatalog',
        enabled: true,
        props: {
            title: 'Our Courses',
            showFilters: true,
            filtersConfig: [{ id: 'level', label: 'Level', type: 'checkbox', field: 'level_name' }],
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
                title: 'My Platform',
                text: 'Welcome to our platform.',
                socials: [],
            },
            rightSection: { title: 'Links', links: [] },
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
            headerText: 'Success Stories',
            description: 'Hear directly from our learners.',
            media: [],
            layout: 'carousel',
            styles: { backgroundColor: '#F0F9FF', roundedEdges: true }, // design-lint-ignore: page-builder template default color
        },
    },

    statsHighlights: {
        type: 'statsHighlights',
        enabled: true,
        props: {
            headerText: 'Our Achievements',
            description: 'Numbers that speak about our growth.',
            stats: [{ label: 'Students', value: '100+' }],
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
            headerText: 'What Our Students Say',
            description: 'Real feedback from our learners.',
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
            title: 'Book Collection',
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
            heading: 'Choose Your Path',
            buy: { buttonLabel: 'Buy', levelFilterValue: 'Buy', targetRoute: 'homepage' },
            rent: { buttonLabel: 'Rent', levelFilterValue: 'Rent', targetRoute: 'homepage' },
        },
    },

    policyRenderer: {
        type: 'policyRenderer',
        enabled: true,
        props: {
            policies: {
                shipping: { title: 'Policy', content: '<p>Content here</p>' },
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
            headerText: 'Frequently Asked Questions',
            subheading: 'Everything you need to know.',
            faqs: [
                { question: 'What courses do you offer?', answer: 'We offer a wide range of courses across multiple disciplines.' },
                { question: 'How do I enroll?', answer: 'Simply sign up, browse our catalogue, and click enroll on any course.' },
                { question: 'Is there a free trial?', answer: 'Yes! Many of our courses offer a free preview.' },
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
            title: 'Watch Our Story',
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
            heading: 'Ready to Get Started?',
            subheading: 'Join thousands of learners and start your journey today.',
            backgroundColor: '#3B82F6', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            layout: 'centered',
            button: {
                enabled: true,
                text: 'Start Learning',
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
            headerText: 'Choose Your Plan',
            subheading: 'Simple, transparent pricing for everyone.',
            plans: [
                {
                    name: 'Basic',
                    price: 'Free',
                    period: '',
                    description: 'Perfect for getting started',
                    features: ['5 Courses', 'Community access', 'Email support'],
                    highlighted: false,
                    buttonText: 'Get Started',
                    buttonTarget: '',
                },
                {
                    name: 'Pro',
                    price: '₹999',
                    period: '/month',
                    description: 'For serious learners',
                    features: ['Unlimited Courses', 'Priority support', 'Certificates', 'Live sessions'],
                    highlighted: true,
                    buttonText: 'Get Pro',
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
            title: 'Register your interest',
            subtitle: "Fill in your details and we'll get back to you.",
            submitLabel: 'Submit',
            successMessage: "Thank you! We've received your details.",
            layout: 'card',
            align: 'center',
        },
    },

    contactForm: {
        type: 'contactForm',
        enabled: true,
        props: {
            heading: 'Get In Touch',
            subheading: "We'd love to hear from you. Send us a message!",
            fields: [
                { name: 'name', label: 'Full Name', type: 'text', required: true },
                { name: 'email', label: 'Email Address', type: 'email', required: true },
                { name: 'phone', label: 'Phone Number', type: 'text', required: false },
                { name: 'message', label: 'Message', type: 'textarea', required: true },
            ],
            submitLabel: 'Send Message',
            successMessage: "Thank you! We'll be in touch soon.",
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
            headerText: 'Meet Our Team',
            subheading: 'The passionate people behind our platform.',
            members: [
                {
                    name: 'Team Member',
                    role: 'Co-Founder & CEO',
                    bio: 'Passionate about education and technology.',
                    avatar: '',
                    socials: [],
                },
                {
                    name: 'Team Member',
                    role: 'Head of Learning',
                    bio: 'Dedicated to creating the best learning experience.',
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
            headerText: 'Latest Updates',
            subheading: 'Stay up to date with our latest news.',
            announcements: [
                {
                    title: 'New Course Launch',
                    date: '2025-01-15',
                    summary: 'We are excited to announce our new advanced course series.',
                    tag: 'News',
                },
                {
                    title: 'Platform Update',
                    date: '2025-01-10',
                    summary: 'We have improved our platform for a better learning experience.',
                    tag: 'Update',
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
            headerText: 'Gallery',
            subheading: '',
            images: [
                { src: '', alt: 'Gallery image 1', caption: '' },
                { src: '', alt: 'Gallery image 2', caption: '' },
                { src: '', alt: 'Gallery image 3', caption: '' },
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
                { title: 'Tab 1', content: '<p>Content for tab 1</p>' },
                { title: 'Tab 2', content: '<p>Content for tab 2</p>' },
                { title: 'Tab 3', content: '<p>Content for tab 3</p>' },
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
            headerText: 'Trusted By',
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
            text: 'Trusted by 10,000+ learners',
            rating: 4.8,
            avatars: [],
            alignment: 'center',
        },
    },

    sectionHeading: {
        type: 'sectionHeading',
        enabled: true,
        props: {
            eyebrow: 'Why choose us',
            title: 'Learning that actually sticks',
            highlight: { text: 'actually sticks', style: 'gradient' },
            lead: 'Programs designed around outcomes — not just content.',
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
            title: 'Our Location',
        },
    },

    countdownTimer: {
        type: 'countdownTimer',
        enabled: true,
        props: {
            targetDate: '',
            heading: 'Event Starts In',
            expiredMessage: 'The event has started!',
            backgroundColor: '#1E293B', // design-lint-ignore: page-builder template default color
            textColor: '#FFFFFF', // design-lint-ignore: page-builder template default color
            style: 'cards',
        },
    },
    textBlock: {
        type: 'textBlock',
        enabled: true,
        props: {
            content: '<h2>Your Heading Here</h2><p>Write your content here. This is a rich text block — you can add headings, paragraphs, lists, links, and more.</p>',
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
                    tag: 'Flagship Program',
                    headerVariant: 'solid',
                    title: 'Flagship Program',
                    description: 'One or two sentences on who this is for and what it covers.',
                    items: [
                        { title: 'What is covered', description: 'A concrete detail about the syllabus, materials or teaching.' },
                        { title: 'How it is taught', description: 'Live classes, recordings, doubt sessions — whatever is true here.' },
                        { title: 'Practice and testing', description: 'Test series, previous papers, analytics.' },
                    ],
                    specs: [
                        { label: 'Eligibility', value: 'Who can join' },
                        { label: 'Mode', value: 'Classroom + online' },
                        { label: 'Duration', value: '12 months' },
                        { label: 'Level', value: 'Beginner to advanced' },
                    ],
                    note: 'Optional note — concessions, instalments, or anything that needs calling out.',
                    noteTone: 'warn',
                },
                {
                    anchor: 'second-program',
                    tag: 'Category',
                    title: 'Second Program',
                    description: 'Duplicate this block for every programme you offer.',
                    items: [
                        { title: 'Detail one', description: 'Replace with a real detail.' },
                        { title: 'Detail two', description: 'Replace with a real detail.' },
                    ],
                    specs: [
                        { label: 'Eligibility', value: 'Who can join' },
                        { label: 'Mode', value: 'Online' },
                    ],
                },
            ],
        },
    },

    featureGrid: {
        type: 'featureGrid',
        enabled: true,
        props: {
            headerText: 'Why Choose Us',
            subheading: 'Everything you need to succeed',
            columns: 3,
            features: [
                // style 'cards'/'glass'/'tinted': icon + title + description (+ optional chips/bullets).
                { iconName: 'GraduationCap', title: 'Expert Instructors', description: 'Learn from industry professionals with years of experience.', chips: ['IIT/NIT faculty'] },
                { iconName: 'BookOpen', title: 'Rich Content', description: 'Access comprehensive course materials and resources.' },
                { iconName: 'Trophy', title: 'Certified Courses', description: 'Earn recognized certificates upon completion.' },
                // style 'panel' (divisions/comparison): a card = tinted header
                // {badge, iconName, title, description, headerVariant 'solid'|'tint'
                // or headerColor '#rrggbb'} over a body of `bullets`. Make one
                // pillar headerVariant 'solid' to stand out.
                {
                    badge: 'Training Division', iconName: 'GraduationCap', headerVariant: 'solid',
                    title: 'CGP Career Avenues', description: 'Comprehensive coaching across every engineering branch.',
                    bullets: ['GATE — CS, ECE, EEE, ME, CE, CH', 'Post-GATE ISRO/BARC/DRDO batches', 'Kerala PSC & campus placement'],
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
            alt: 'Image',
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
            text: 'Get Started',
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
            heading: 'Stay Updated',
            subheading: 'Subscribe to our newsletter for the latest updates.',
            placeholder: 'Enter your email',
            buttonText: 'Subscribe',
            layout: 'inline',
            backgroundColor: '#F8FAFC', // design-lint-ignore: page-builder template default color
            successMessage: 'Thank you for subscribing!',
            // Destination campaign (Audience Manager). Empty = the auto list.
            audienceId: '',
            audienceName: '',
        },
    },

    stepsProcess: {
        type: 'stepsProcess',
        enabled: true,
        props: {
            headerText: 'How It Works',
            subheading: 'Get started in just a few steps',
            layout: 'horizontal',
            steps: [
                { number: '1', title: 'Sign Up', description: 'Create your free account in seconds.' },
                { number: '2', title: 'Choose a Course', description: 'Browse our catalog and pick what interests you.' },
                { number: '3', title: 'Start Learning', description: 'Access your course materials and begin.' },
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
                { icon: '⭐', text: 'Top-rated courses' },
                { icon: '🎓', text: '10,000+ learners enrolled' },
                { icon: '🏆', text: 'Expert-led curriculum' },
                { icon: '🚀', text: 'Learn at your own pace' },
                { icon: '💡', text: 'Industry-relevant skills' },
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
            title: 'Our Programs',
            subtitle: 'Pick a program and enrol in minutes.',
            columns: 3,
            // 'grid' wraps onto rows; 'carousel' is one swipeable horizontal row.
            layout: 'grid',
            // App-style rail header by default: left-aligned, compact type, with
            // a "See all" link into the product page. Existing saved pages have
            // no align/headerScale props and keep the old centered look.
            align: 'left',
            headerScale: 'md',
            showViewAll: true,
            viewAllLabel: 'See all',
            ctaLabel: 'Enrol now',
            showImage: true,
            showChips: true,
            showDescription: true,
            showValidity: true,
            showPrice: true,
            // Product pages can carry 150+ courses (book stores especially), so
            // paginate by default; 0 renders every course with no pager.
            pageSize: 9,
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
};

export const getComponentTemplate = (type: string): Component => {
    const template = componentTemplates[type];
    if (!template) throw new Error(`Unknown component type: ${type}`);

    return {
        ...template,
        id: `${type}-${uuidv4().slice(0, 8)}`,
        props: JSON.parse(JSON.stringify(template.props)), // Deep copy props
    };
};
