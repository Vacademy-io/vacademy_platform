export interface ReportBrandingSettings {
    primary_color: string;
    secondary_color: string;
    show_letterhead: boolean;
    letterhead_file_id: string | null;
    show_logo_in_header: boolean;
    logo_file_id: string | null;
    show_watermark: boolean;
    watermark_text: string;
    watermark_opacity: number;
    footer_text: string;
    header_html: string;
    footer_html: string;
}

/**
 * Role-wise control over who receives assessment result / evaluation
 * notifications (result-release + re-evaluation emails, and learner reports).
 * `roles` maps a role key (uppercased: ADMIN / TEACHER / STUDENT / LEARNER /
 * EVALUATOR / a custom role name) to whether that role receives the notification.
 * A role absent from the map falls back to the default: STUDENT/LEARNER = on,
 * every other role (incl. ADMIN) = off.
 */
export interface ResultNotificationSettings {
    version: number;
    roles: Record<string, boolean>;
}

export interface AssessmentSettingsData {
    offlineEntry: {
        enabled: boolean;
    };
    reportBranding: ReportBrandingSettings;
    resultNotifications: ResultNotificationSettings;
}

/** Default: STUDENT/LEARNER receive results; every other role (incl. ADMIN) does not. */
export const defaultReceivesResultNotification = (roleKey: string): boolean => {
    const key = (roleKey || '').toUpperCase();
    return key === 'STUDENT' || key === 'LEARNER';
};

export interface AssessmentSettingsRequest {
    setting_name: string;
    setting_data: AssessmentSettingsData;
}

export interface AssessmentSettingsResponse {
    data: AssessmentSettingsData;
}

export const DEFAULT_REPORT_BRANDING: ReportBrandingSettings = {
    primary_color: '#FF6B35',
    secondary_color: '#6C5CE7',
    show_letterhead: false,
    letterhead_file_id: null,
    show_logo_in_header: true,
    logo_file_id: null,
    show_watermark: false,
    watermark_text: '',
    watermark_opacity: 0.05,
    footer_text: 'This report is auto-generated. For queries, contact your institute administrator.',
    header_html: '',
    footer_html: '',
};

export const DEFAULT_ASSESSMENT_SETTINGS: AssessmentSettingsData = {
    offlineEntry: {
        enabled: false,
    },
    reportBranding: { ...DEFAULT_REPORT_BRANDING },
    // Empty map => backend applies per-role defaults (STUDENT on, everything else off).
    resultNotifications: { version: 1, roles: {} },
};
