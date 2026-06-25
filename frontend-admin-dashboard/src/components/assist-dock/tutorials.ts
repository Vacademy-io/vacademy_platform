// Route → tutorial mapping for the Assist Dock (right rail).
//
// AUTO-DRAFTED from the 55 walkthroughs-v2 filenames — REVIEW the `routes`/`tab`
// for accuracy. Each tutorial is one self-contained animated HTML on S3.
//
// Matching: a tutorial shows when the current pathname startsWith one of `routes`.
// For Settings tutorials, `tab` further narrows to a specific Settings tab
// (the `selectedTab` search param) so a page only shows its own walkthroughs.

export const TUTORIALS_BASE_URL =
    'https://vacademy-tutorials.s3.us-east-1.amazonaws.com/walkthroughs-v2';

export interface Tutorial {
    id: string;
    /** Filename on S3 (under TUTORIALS_BASE_URL). */
    file: string;
    title: string;
    /** Pathname prefixes where this tutorial is relevant. */
    routes: string[];
    /** Optional Settings tab (the `selectedTab` value) for finer matching on /settings. */
    tab?: string;
}

const f = (slug: string) => `admin-how-to-${slug}.html`;

export const TUTORIALS: Tutorial[] = [
    // ── Courses / content ────────────────────────────────────────────────
    {
        id: 'create-a-course',
        file: f('create-a-course'),
        title: 'Create a course',
        routes: ['/study-library/courses', '/study-library'],
    },

    // ── Batches / sessions (Manage Institute) ────────────────────────────
    {
        id: 'create-a-batch',
        file: f('create-a-batch'),
        title: 'Create a batch',
        routes: ['/manage-institute/batches'],
    },
    {
        id: 'create-a-session',
        file: f('create-a-session'),
        title: 'Create a session',
        routes: ['/manage-institute/sessions'],
    },

    // ── Learners (Manage Students) ───────────────────────────────────────
    {
        id: 'enroll-a-learner',
        file: f('enroll-a-learner'),
        title: 'Enroll a learner',
        routes: ['/manage-students', '/manage-institute/batches'],
    },
    {
        id: 'add-a-tag-to-a-student',
        file: f('add-a-tag-to-a-student'),
        title: 'Add a tag to a student',
        routes: ['/manage-students'],
    },
    {
        id: 'edit-a-learner-details',
        file: f('edit-a-learner-details'),
        title: 'Edit a learner’s details',
        routes: ['/manage-students'],
    },
    {
        id: 'create-a-user-tag',
        file: f('create-a-user-tag'),
        title: 'Create a user tag',
        routes: ['/manage-students', '/audience-manager'],
    }, // REVIEW route

    // ── CRM / Leads (Audience Manager) ───────────────────────────────────
    {
        id: 'assign-a-counselor-to-a-lead',
        file: f('assign-a-counselor-to-a-lead'),
        title: 'Assign a counselor to a lead',
        routes: ['/audience-manager/recent-leads', '/audience-manager/follow-ups'],
    },
    {
        id: 'log-a-note-for-a-lead',
        file: f('log-a-note-for-a-lead'),
        title: 'Log a note for a lead',
        routes: ['/audience-manager/recent-leads'],
    },
    {
        id: 'log-a-call-with-a-lead',
        file: f('log-a-call-with-a-lead'),
        title: 'Log a call with a lead',
        routes: ['/audience-manager/recent-leads'],
    },
    {
        id: 'log-a-meeting-with-a-lead',
        file: f('log-a-meeting-with-a-lead'),
        title: 'Log a meeting with a lead',
        routes: ['/audience-manager/recent-leads'],
    },
    {
        id: 'schedule-a-follow-up-for-a-lead',
        file: f('schedule-a-follow-up-for-a-lead'),
        title: 'Schedule a follow-up for a lead',
        routes: ['/audience-manager/follow-ups', '/audience-manager/recent-leads'],
    },
    {
        id: 'change-a-lead-status',
        file: f('change-a-lead-status'),
        title: 'Change a lead status',
        routes: ['/audience-manager/recent-leads'],
    },

    // ── Lead pools (Settings › Leads › Pools) ────────────────────────────
    {
        id: 'create-a-lead-distribution-pool',
        file: f('create-a-lead-distribution-pool'),
        title: 'Create a lead distribution pool',
        routes: ['/settings/leads/pools', '/settings'],
        tab: 'leadSettings',
    },
    {
        id: 'update-a-lead-pool',
        file: f('update-a-lead-pool'),
        title: 'Update a lead pool',
        routes: ['/settings/leads/pools'],
    },
    {
        id: 'add-a-counselor-to-a-pool',
        file: f('add-a-counselor-to-a-pool'),
        title: 'Add a counselor to a pool',
        routes: ['/settings/leads/pools'],
    },
    {
        id: 'attach-a-campaign-to-a-pool',
        file: f('attach-a-campaign-to-a-pool'),
        title: 'Attach a campaign to a pool',
        routes: ['/settings/leads/pools'],
    },

    // ── Lead config (Settings › Lead Settings) ───────────────────────────
    {
        id: 'set-up-custom-lead-statuses',
        file: f('set-up-custom-lead-statuses'),
        title: 'Set up custom lead statuses',
        routes: ['/settings'],
        tab: 'leadSettings',
    },
    {
        id: 'configure-lead-scoring-rules',
        file: f('configure-lead-scoring-rules'),
        title: 'Configure lead scoring rules',
        routes: ['/settings'],
        tab: 'leadSettings',
    },
    {
        id: 'set-counsellor-monthly-targets',
        file: f('set-counsellor-monthly-targets'),
        title: 'Set counsellor monthly targets',
        routes: ['/settings', '/sales-dashboard'],
        tab: 'leadSettings',
    },

    // ── Naming (Settings › Naming) ───────────────────────────────────────
    {
        id: 'rename-content-terms',
        file: f('rename-content-terms'),
        title: 'Rename content terms',
        routes: ['/settings'],
        tab: 'naming',
    },
    {
        id: 'rename-role-terms',
        file: f('rename-role-terms'),
        title: 'Rename role terms',
        routes: ['/settings'],
        tab: 'naming',
    },
    {
        id: 'rename-other-terms',
        file: f('rename-other-terms'),
        title: 'Rename other terms',
        routes: ['/settings'],
        tab: 'naming',
    },
    {
        id: 'rename-system-terminology',
        file: f('rename-system-terminology'),
        title: 'Rename system terminology',
        routes: ['/settings'],
        tab: 'naming',
    },

    // ── Display & roles (Settings) ───────────────────────────────────────
    {
        id: 'configure-admin-display-settings',
        file: f('configure-admin-display-settings'),
        title: 'Configure admin display settings',
        routes: ['/settings'],
        tab: 'roleDisplay',
    },
    {
        id: 'configure-student-display-settings',
        file: f('configure-student-display-settings'),
        title: 'Configure student display settings',
        routes: ['/settings'],
        tab: 'studentDisplay',
    },
    {
        id: 'create-a-custom-role',
        file: f('create-a-custom-role'),
        title: 'Create a custom role',
        routes: ['/settings'],
        tab: 'roleDisplay',
    },
    {
        id: 'create-a-custom-team',
        file: f('create-a-custom-team'),
        title: 'Create a custom team',
        routes: ['/manage-custom-teams'],
    },
    {
        id: 'create-a-custom-field',
        file: f('create-a-custom-field'),
        title: 'Create a custom field',
        routes: ['/settings'],
        tab: 'customFields',
    },
    {
        id: 'set-up-content-protection',
        file: f('set-up-content-protection'),
        title: 'Set up content protection',
        routes: ['/settings'],
        tab: 'contentProtection',
    },

    // ── Feature settings (Settings) ──────────────────────────────────────
    {
        id: 'configure-assessment-settings',
        file: f('configure-assessment-settings'),
        title: 'Configure assessment settings',
        routes: ['/settings'],
        tab: 'assessment',
    },
    {
        id: 'configure-course-settings',
        file: f('configure-course-settings'),
        title: 'Configure course settings',
        routes: ['/settings'],
        tab: 'course',
    },
    {
        id: 'configure-live-session-settings',
        file: f('configure-live-session-settings'),
        title: 'Configure live session settings',
        routes: ['/settings'],
        tab: 'liveSession',
    },
    {
        id: 'configure-school-settings',
        file: f('configure-school-settings'),
        title: 'Configure school settings',
        routes: ['/settings'],
        tab: 'schoolSettings',
    },
    {
        id: 'enable-youtube-integration',
        file: f('enable-youtube-integration'),
        title: 'Enable YouTube integration',
        routes: ['/settings'],
        tab: 'youtube',
    },
    {
        id: 'set-up-google-tag-manager',
        file: f('set-up-google-tag-manager'),
        title: 'Set up Google Tag Manager',
        routes: ['/settings'],
        tab: 'gtmSettings',
    },
    {
        id: 'set-up-student-terms-and-conditions',
        file: f('set-up-student-terms-and-conditions'),
        title: 'Set up student terms & conditions',
        routes: ['/settings'],
        tab: 'tnc',
    },
    {
        id: 'create-a-doubt-category',
        file: f('create-a-doubt-category'),
        title: 'Create a doubt category',
        routes: ['/settings', '/study-library/doubt-management'],
        tab: 'doubtManagement',
    },

    // ── Payments / invoices / coupons (Settings) ─────────────────────────
    {
        id: 'create-a-payment-plan',
        file: f('create-a-payment-plan'),
        title: 'Create a payment plan',
        routes: ['/settings'],
        tab: 'payment',
    },
    {
        id: 'create-a-coupon',
        file: f('create-a-coupon'),
        title: 'Create a coupon',
        routes: ['/settings'],
        tab: 'coupons',
    },
    {
        id: 'create-a-flat-discount-coupon',
        file: f('create-a-flat-discount-coupon'),
        title: 'Create a flat discount coupon',
        routes: ['/settings'],
        tab: 'coupons',
    },
    {
        id: 'create-a-referral-reward',
        file: f('create-a-referral-reward'),
        title: 'Create a referral reward',
        routes: ['/settings'],
        tab: 'referral',
    },
    {
        id: 'configure-invoice-options',
        file: f('configure-invoice-options'),
        title: 'Configure invoice options',
        routes: ['/settings'],
        tab: 'invoice',
    },
    {
        id: 'set-the-invoice-tax-label',
        file: f('set-the-invoice-tax-label'),
        title: 'Set the invoice tax label',
        routes: ['/settings'],
        tab: 'invoice',
    },
    {
        id: 'add-a-tax-rate',
        file: f('add-a-tax-rate'),
        title: 'Add a tax rate',
        routes: ['/settings'],
        tab: 'invoice',
    },
    {
        id: 'set-your-time-zone-and-currency',
        file: f('set-your-time-zone-and-currency'),
        title: 'Set your time zone & currency',
        routes: ['/settings'],
        tab: 'payment',
    }, // REVIEW tab

    // ── White-label / portal branding (Settings › White-Label Setup) ─────
    {
        id: 'set-theme-primary-color',
        file: f('set-theme-primary-color'),
        title: 'Set the theme primary color',
        routes: ['/settings', '/dashboard'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-portal-font',
        file: f('set-your-portal-font'),
        title: 'Set your portal font',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-portal-tab-title',
        file: f('set-your-portal-tab-title'),
        title: 'Set your portal tab title',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-privacy-policy-url',
        file: f('set-your-privacy-policy-url'),
        title: 'Set your privacy policy URL',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-terms-url',
        file: f('set-your-terms-url'),
        title: 'Set your terms URL',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-ios-app-link',
        file: f('set-your-ios-app-link'),
        title: 'Set your iOS app link',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },
    {
        id: 'set-your-android-app-link',
        file: f('set-your-android-app-link'),
        title: 'Set your Android app link',
        routes: ['/settings'],
        tab: 'whiteLabel',
    },

    // ── Booking (REVIEW: confirm the actual route for these) ─────────────
    {
        id: 'create-a-booking-type',
        file: f('create-a-booking-type'),
        title: 'Create a booking type',
        routes: ['/settings'],
    }, // REVIEW route
    {
        id: 'create-a-booking-event',
        file: f('create-a-booking-event'),
        title: 'Create a booking event',
        routes: ['/settings'],
    }, // REVIEW route
];

/** Tutorials relevant to the current location (pathname + optional settings tab). */
export function tutorialsForRoute(pathname: string, selectedTab?: string | null): Tutorial[] {
    return TUTORIALS.filter((t) => {
        const pathMatch = t.routes.some((r) => pathname.startsWith(r));
        if (!pathMatch) return false;
        // On /settings, a tutorial with a `tab` only shows for its own tab.
        if (t.tab && pathname.startsWith('/settings') && selectedTab) {
            return t.tab === selectedTab;
        }
        return true;
    });
}
