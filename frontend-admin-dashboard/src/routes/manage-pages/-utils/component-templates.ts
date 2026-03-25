import { v4 as uuidv4 } from 'uuid';
import { Component } from '../-types/editor-types';

export const componentTemplates: Record<string, Omit<Component, 'id'>> = {
    header: {
        type: 'header',
        enabled: true,
        props: {
            logo: '',
            title: 'My Platform',
            navigation: [{ label: 'Home', route: 'homepage', openInSameTab: true }],
            authLinks: [{ label: 'Login', route: 'login' }],
        },
    },

    heroSection: {
        type: 'heroSection',
        enabled: true,
        props: {
            layout: 'split',
            backgroundColor: '#F8FAFC',
            left: {
                title: 'Welcome to Our Platform',
                description: 'Start your learning journey today.',
                button: {
                    enabled: false,
                    text: 'Get Started',
                    action: 'navigate',
                    target: '',
                },
            },
            right: { image: '', alt: 'Hero image' },
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
                    backgroundColor: '#FFFFFF',
                },
            },
        },
    },

    footer: {
        type: 'footer',
        enabled: true,
        props: {
            layout: 'two-column',
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
            styles: { backgroundColor: '#F0F9FF', roundedEdges: true },
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
            styles: { backgroundColor: '#FFFFFF', textColor: '#111827', hoverEffect: 'scale' },
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
            styles: {
                backgroundColor: '#F9FAFB',
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
            backgroundColor: '#F9FAFB',
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
            backgroundColor: '#000000',
        },
    },

    ctaBanner: {
        type: 'ctaBanner',
        enabled: true,
        props: {
            heading: 'Ready to Get Started?',
            subheading: 'Join thousands of learners and start your journey today.',
            backgroundColor: '#3B82F6',
            textColor: '#FFFFFF',
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
            backgroundColor: '#FFFFFF',
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
            backgroundColor: '#FFFFFF',
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
            dividerColor: '#E5E7EB',
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
            backgroundColor: '#FFFFFF',
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
            backgroundColor: '#1E293B',
            textColor: '#FFFFFF',
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

    featureGrid: {
        type: 'featureGrid',
        enabled: true,
        props: {
            headerText: 'Why Choose Us',
            subheading: 'Everything you need to succeed',
            columns: 3,
            features: [
                { icon: '🎓', title: 'Expert Instructors', description: 'Learn from industry professionals with years of experience.' },
                { icon: '📚', title: 'Rich Content', description: 'Access comprehensive course materials and resources.' },
                { icon: '🏆', title: 'Certified Courses', description: 'Earn recognized certificates upon completion.' },
                { icon: '💡', title: 'Interactive Learning', description: 'Engage with hands-on projects and exercises.' },
                { icon: '🕐', title: 'Flexible Schedule', description: 'Learn at your own pace, anytime, anywhere.' },
                { icon: '🤝', title: 'Community Support', description: 'Join a thriving community of learners.' },
            ],
            style: 'cards',
            iconSize: 'large',
            backgroundColor: '#FFFFFF',
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
            backgroundColor: '#F8FAFC',
            successMessage: 'Thank you for subscribing!',
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
            backgroundColor: '#FFFFFF',
            accentColor: '',
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
