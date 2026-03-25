export interface AssessmentSettingsData {
    offlineEntry: {
        enabled: boolean;
    };
}

export interface AssessmentSettingsRequest {
    setting_name: string;
    setting_data: AssessmentSettingsData;
}

export interface AssessmentSettingsResponse {
    data: AssessmentSettingsData;
}

export const DEFAULT_ASSESSMENT_SETTINGS: AssessmentSettingsData = {
    offlineEntry: {
        enabled: false,
    },
};
