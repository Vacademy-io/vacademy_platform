// ── Field Length Constants ──────────────────────────────────────────
export const MAX_LENGTH = {
    NAME: 255,
    ADDRESS: 512,
    TEXTAREA: 1024,
    NOTES: 2000,
    EMAIL: 320,
    SCHOOL_NAME: 255,
    QUALIFICATION: 255,
    OCCUPATION: 255,
    RELIGION: 255,
    CASTE: 255,
    NATIONALITY: 255,
    MOTHER_TONGUE: 255,
    APPLICATION_NUMBER: 50,
    PREVIOUS_ADMISSION_NO: 50,
    AADHAAR: 12,
    PINCODE: 6,
    YEAR: 4,
    PHONE: 15,
    GENERAL: 255,
} as const;

// ── Regex Patterns ─────────────────────────────────────────────────
const DIGITS_ONLY = /^\d*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Validators ─────────────────────────────────────────────────────

/** Aadhaar: exactly 12 digits */
export function isValidAadhaar(value: string): boolean {
    const digits = value.replace(/[\s-]/g, '');
    return digits.length === 12 && DIGITS_ONLY.test(digits);
}

/** Aadhaar: partial check while typing (0-12 digits ok) */
export function isPartialAadhaar(value: string): boolean {
    const digits = value.replace(/[\s-]/g, '');
    return digits.length <= 12 && DIGITS_ONLY.test(digits);
}

/** Format 12 digits as XXXX-XXXX-XXXX */
export function formatAadhaar(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

/** Extract raw digits from formatted aadhaar */
export function getAadhaarDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, 12);
}

/** Email validation */
export function isValidEmail(value: string): boolean {
    if (!value) return true; // empty is ok (use required check separately)
    return EMAIL_REGEX.test(value.trim());
}

/** Indian pincode: exactly 6 digits */
export function isValidPincode(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length === 6 && DIGITS_ONLY.test(trimmed);
}

/** Year: 4 digits in a reasonable range */
export function isValidYear(value: string): boolean {
    if (!value) return true;
    const trimmed = value.trim();
    if (trimmed.length !== 4 || !DIGITS_ONLY.test(trimmed)) return false;
    const num = parseInt(trimmed, 10);
    return num >= 1950 && num <= 2099;
}

/** Percentage: 0–100 with up to 2 decimal places */
export function isValidPercentage(value: string): boolean {
    if (!value) return true;
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (num < 0 || num > 100) return false;
    // Check max 2 decimal places
    const parts = value.split('.');
    if (parts[1] && parts[1].length > 2) return false;
    return true;
}

/** Phone: digits only (after stripping +, spaces, dashes), 10-15 digits */
export function isValidPhone(value: string): boolean {
    if (!value) return true;
    const digits = value.replace(/[\s\-+()]/g, '');
    return digits.length >= 10 && digits.length <= 15 && DIGITS_ONLY.test(digits);
}

/** Generic non-empty check */
export function isNonEmpty(value: string | undefined | null): boolean {
    return !!value && value.trim().length > 0;
}

/**
 * Normalize a phone number for react-phone-input-2.
 * The library expects digits with country code (e.g. "919876543210").
 * - If already has country code (11+ digits), return as-is (digits only).
 * - If bare 10-digit Indian number, prefix with "91".
 * - Strips +, spaces, dashes.
 */
export function normalizePhoneForInput(phone: string | undefined | null, defaultCountryCode = '91'): string {
    if (!phone) return '';
    const digits = phone.replace(/[\s\-+()]/g, '');
    if (!digits) return '';
    // Already has country code (11+ digits)
    if (digits.length > 10) return digits;
    // Bare 10-digit number — add default country code
    if (digits.length === 10) return `${defaultCountryCode}${digits}`;
    return digits;
}

/**
 * Normalize aadhaar: strip dashes/spaces, keep only digits (max 12).
 * Handles pre-populated data that may come formatted as "XXXX-XXXX-XXXX".
 */
export function normalizeAadhaar(value: string | undefined | null): string {
    if (!value) return '';
    return value.replace(/\D/g, '').slice(0, 12);
}

// ── Per-step validation for Admission Form ─────────────────────────

export interface ValidationError {
    field: string;
    message: string;
}

export function validateAdmissionStep1(formData: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!isNonEmpty(formData.studentFirstName)) {
        errors.push({ field: 'studentFirstName', message: 'First name is required' });
    }
    if (!isNonEmpty(formData.studentLastName)) {
        errors.push({ field: 'studentLastName', message: 'Last name is required' });
    }
    if (!isNonEmpty(formData.dateOfBirth)) {
        errors.push({ field: 'dateOfBirth', message: 'Date of birth is required' });
    }
    if (!isNonEmpty(formData.destinationPackageSessionId)) {
        errors.push({ field: 'destinationPackageSessionId', message: 'Class selection is required' });
    }
    if (formData.aadhaarNumber && !isValidAadhaar(formData.aadhaarNumber)) {
        errors.push({ field: 'aadhaarNumber', message: 'Aadhaar must be exactly 12 digits' });
    }
    if (formData.residentialPhone && !isValidPhone(formData.residentialPhone)) {
        errors.push({ field: 'residentialPhone', message: 'Enter a valid phone number' });
    }

    return errors;
}

export function validateAdmissionStep2(formData: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (formData.yearOfPassing && !isValidYear(formData.yearOfPassing)) {
        errors.push({ field: 'yearOfPassing', message: 'Year must be 4 digits (1950–2099)' });
    }
    if (formData.percentage && !isValidPercentage(formData.percentage)) {
        errors.push({ field: 'percentage', message: 'Percentage must be 0–100 with max 2 decimals' });
    }
    if (formData.percentageScience && !isValidPercentage(formData.percentageScience)) {
        errors.push({ field: 'percentageScience', message: 'Percentage must be 0–100 with max 2 decimals' });
    }
    if (formData.percentageMaths && !isValidPercentage(formData.percentageMaths)) {
        errors.push({ field: 'percentageMaths', message: 'Percentage must be 0–100 with max 2 decimals' });
    }

    return errors;
}

export function validateAdmissionStep3(formData: Record<string, any>): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!isNonEmpty(formData.fatherName) && !isNonEmpty(formData.motherName)) {
        errors.push({ field: 'fatherName', message: 'At least one parent name is required' });
    }
    if (!isNonEmpty(formData.fatherMobile) && !isNonEmpty(formData.motherMobile)) {
        errors.push({ field: 'fatherMobile', message: 'At least one parent mobile is required' });
    }
    if (formData.fatherEmail && !isValidEmail(formData.fatherEmail)) {
        errors.push({ field: 'fatherEmail', message: 'Enter a valid email address' });
    }
    if (formData.motherEmail && !isValidEmail(formData.motherEmail)) {
        errors.push({ field: 'motherEmail', message: 'Enter a valid email address' });
    }
    if (formData.fatherAadhaar && !isValidAadhaar(formData.fatherAadhaar)) {
        errors.push({ field: 'fatherAadhaar', message: 'Father Aadhaar must be exactly 12 digits' });
    }
    if (formData.motherAadhaar && !isValidAadhaar(formData.motherAadhaar)) {
        errors.push({ field: 'motherAadhaar', message: 'Mother Aadhaar must be exactly 12 digits' });
    }
    if (formData.fatherMobile && !isValidPhone(formData.fatherMobile)) {
        errors.push({ field: 'fatherMobile', message: 'Enter a valid father mobile number' });
    }
    if (formData.motherMobile && !isValidPhone(formData.motherMobile)) {
        errors.push({ field: 'motherMobile', message: 'Enter a valid mother mobile number' });
    }
    if (formData.guardianMobile && !isValidPhone(formData.guardianMobile)) {
        errors.push({ field: 'guardianMobile', message: 'Enter a valid guardian mobile number' });
    }

    return errors;
}

// ── Previous Class options (shared enum) ───────────────────────────
export const PREVIOUS_CLASS_OPTIONS = [
    'Kindergarten',
    'Nursery',
    'LKG',
    'UKG',
    'Class 1',
    'Class 2',
    'Class 3',
    'Class 4',
    'Class 5',
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
    'Class 11',
    'Class 12',
] as const;

// ── Board options (shared enum) ────────────────────────────────────
export const BOARD_OPTIONS = ['SSC', 'CBSE', 'ICSE', 'IGCSE', 'IB', 'Others'] as const;

// ── Gender options ─────────────────────────────────────────────────
export const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'] as const;

// ── Nationality options ────────────────────────────────────────────
export const NATIONALITY_OPTIONS = ['Indian', 'Other'] as const;

// ── Religion options ───────────────────────────────────────────────
export const RELIGION_OPTIONS = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'] as const;

// ── Category options ───────────────────────────────────────────────
export const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'EWS'] as const;

// ── Blood Group options ────────────────────────────────────────────
export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;

// ── Mother Tongue options ──────────────────────────────────────────
export const MOTHER_TONGUE_OPTIONS = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Bengali', 'Malayalam', 'Punjabi', 'Odia', 'Urdu', 'Other'] as const;

// ── ID Type options ────────────────────────────────────────────────
export const ID_TYPE_OPTIONS = [
    { value: 'AADHAR_CARD', label: 'Aadhaar Card' },
    { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
    { value: 'PASSPORT', label: 'Passport' },
    { value: 'OTHER', label: 'Other' },
] as const;

// ── Country options ────────────────────────────────────────────────
export const COUNTRY_OPTIONS = ['India', 'Other'] as const;

// ── Indian States & UTs ────────────────────────────────────────────
export const INDIAN_STATES = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry',
] as const;
