export const defaultTemplate = {
    version: '1.0',
    globalSettings: {
        courseCatalogeType: { enabled: false, value: 'Course' },
        mode: 'light',
        theme: { preset: 'default', borderRadius: 'rounded' },
        fonts: { enabled: true, family: 'Inter, sans-serif' },
        compactness: 'medium',
        audience: 'all',
        leadCollection: {
            enabled: false,
            mandatory: false,
            inviteLink: null,
            formStyle: {
                type: 'single',
                showProgress: false,
                progressType: 'bar',
                transition: 'slide',
            },
            fields: [],
        },
        enrquiry: { enabled: true, requirePayment: false },
        payment: {
            enabled: true,
            provider: 'razorpay',
            fields: ['fullName', 'email', 'phone'],
        },
        layout: {
            header: {
                id: 'header-1',
                type: 'header',
                enabled: true,
                props: {
                    logo: '',
                    title: 'My Platform',
                    navigation: [{ label: 'Home', route: 'homepage', openInSameTab: true }],
                    authLinks: [{ label: 'Login', route: 'login' }],
                },
            },
            footer: {
                id: 'footer-1',
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
        },
    },
    pages: [
        {
            id: 'home',
            route: 'homepage',
            title: 'Home',
            components: [],
        },
    ],
};
