import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';

export const CATALOGUE_EDITOR_CONFIG = {
    // Preview
    LEARNER_APP_URL: BASE_URL_LEARNER_DASHBOARD,
    PREVIEW_DEBOUNCE_MS: 500,

    // History
    MAX_UNDO_HISTORY: 50,
    HISTORY_DEBOUNCE_MS: 300,

    // Validation
    MAX_PAGES: 20,
    MAX_COMPONENTS_PER_PAGE: 30,
    MAX_SLIDES: 10,
    MAX_NAV_ITEMS: 8,
    MAX_TESTIMONIALS: 20,

    // Viewport sizes
    VIEWPORTS: {
        desktop: { width: '100%', height: '100%' }, // 100% of container
        tablet: { width: '768px', height: '1024px' },
        mobile: { width: '375px', height: '667px' },
    },
};
