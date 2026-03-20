export const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
];

export const pricingPlans = [
    {
        name: 'Free',
        description: 'Perfect for small groups and getting started.',
        features: [
            'Up to 20 participants per session',
            'AI Presentation Generator',
            'Interactive Quizzing & Polling',
            'Basic Analytics',
        ],
        prices: {
            monthly: { USD: 0, INR: 0, EUR: 0, GBP: 0 },
            yearly: { USD: 0, INR: 0, EUR: 0, GBP: 0 },
        },
        buttonText: 'Start for Free',
        isMostPopular: false,
    },
    {
        name: 'Pro',
        description: 'Ideal for educators and professionals.',
        features: [
            'Up to 100 participants per session',
            'All features in Free',
            'Live Session Analytics',
            'Audio Transcription & Insights',
            'Import from PowerPoint',
        ],
        prices: {
            monthly: { USD: 10, INR: 799, EUR: 9, GBP: 8 },
            yearly: { USD: 7, INR: 549, EUR: 6, GBP: 5 },
        },
        buttonText: 'Choose Pro',
        isMostPopular: true,
    },
    {
        name: 'Business',
        description: 'For organizations and large teams.',
        features: [
            'Unlimited participants',
            'All features in Pro',
            'Share Session Summary',
            'Dedicated Support',
            'Team Management',
        ],
        prices: {
            monthly: { USD: 25, INR: 1999, EUR: 23, GBP: 20 },
            yearly: { USD: 20, INR: 1599, EUR: 18, GBP: 16 },
        },
        buttonText: 'Contact Sales',
        isMostPopular: false,
    },
];
