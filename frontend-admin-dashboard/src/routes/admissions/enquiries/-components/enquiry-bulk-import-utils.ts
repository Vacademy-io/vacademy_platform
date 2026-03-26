import { ENQUIRY_STATUS_OPTIONS } from '../-services/update-enquiry-status';
import type { EnquirySourceType } from '../-services/submit-enquiry';

const ENQUIRY_STATUS_SET = new Set(ENQUIRY_STATUS_OPTIONS.map((option) => option.value));
const ENQUIRY_STATUS_LABEL_TO_VALUE = new Map(
    ENQUIRY_STATUS_OPTIONS.map((option) => [option.label.toUpperCase(), option.value])
);

const SOURCE_NORMALIZATION_MAP: Record<string, EnquirySourceType> = {
    WEBSITE: 'WEBSITE',
    WEB: 'WEBSITE',
    GOOGLE_ADS: 'GOOGLE_ADS',
    GOOGLEADS: 'GOOGLE_ADS',
    GOOGLE: 'GOOGLE_ADS',
    FACEBOOK: 'FACEBOOK',
    INSTAGRAM: 'INSTAGRAM',
    REFERRAL: 'REFERRAL',
    REFERRALS: 'REFERRAL',
    OTHER: 'OTHER',
    OTHERS: 'OTHER',
};

export const normalizeGender = (value: unknown): 'MALE' | 'FEMALE' | 'OTHER' | null => {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    if (normalized === 'MALE' || normalized === 'FEMALE' || normalized === 'OTHER') {
        return normalized;
    }
    if (normalized === 'OTHERS') {
        return 'OTHER';
    }
    return null;
};

export const parseOptionalEnquiryStatus = (value: unknown): string => {
    if (!value) return 'NEW';
    const normalized = String(value).trim().toUpperCase();
    if (ENQUIRY_STATUS_SET.has(normalized as (typeof ENQUIRY_STATUS_OPTIONS)[number]['value'])) {
        return normalized;
    }
    return ENQUIRY_STATUS_LABEL_TO_VALUE.get(normalized) || 'NEW';
};

export const parseOptionalSourceType = (value: unknown): EnquirySourceType | undefined => {
    if (!value) return undefined;
    const normalized = String(value).trim().toUpperCase().replace(/\s+/g, '_');
    return SOURCE_NORMALIZATION_MAP[normalized];
};

export const parseOptionalParentRelationWithChild = (
    value: unknown
): 'FATHER' | 'MOTHER' | 'GUARDIAN' | undefined => {
    if (!value) return undefined;
    const normalized = String(value).trim().toUpperCase().replace(/\s+/g, '_');
    if (normalized === 'FATHER') return 'FATHER';
    if (normalized === 'MOTHER') return 'MOTHER';
    if (normalized === 'GUARDIAN') return 'GUARDIAN';
    return undefined;
};
