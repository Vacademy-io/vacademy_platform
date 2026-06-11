import { isValidPhoneNumber } from 'libphonenumber-js';
import { z } from 'zod';

/**
 * Country-aware phone validation, shared by every phone input in the app.
 *
 * The phone widget (react-phone-input-2) stores the number in E.164 style with
 * the selected country's dial code embedded as a prefix (e.g. "+919876543210").
 * Because the dial code is part of the value, `isValidPhoneNumber` enforces the
 * correct national length/format for that country automatically — India = exactly
 * 10 digits, US = 10, UK = 10/11, etc. — with no per-country hardcoding.
 *
 * Three entry points cover the three ways phone inputs are wired here:
 *  - {@link phoneSchema}        for react-hook-form + zodResolver forms (schema is the source of truth)
 *  - {@link phoneValidateRule}  for Controller `rules` on non-resolver forms (used by the wrappers)
 *  - {@link validatePhoneField} for plain-useState / manual-validation forms
 */

const DEFAULT_LABEL = 'Phone number';

interface PhoneValidationOptions {
    required?: boolean;
    label?: string;
}

const invalidMessage = (label: string): string =>
    `Enter a valid ${label.toLowerCase()} for the selected country`;

/**
 * True when the value carries no national number beyond the country dial code
 * (e.g. "", undefined, or a dial-code-only "+91"). The longest dial code is 3
 * digits, so anything with <= 3 digits total is treated as blank.
 */
export const isBlankPhone = (value: string | undefined | null): boolean => {
    if (!value) return true;
    return value.replace(/\D/g, '').length <= 3;
};

/**
 * True when `value` is a valid phone number for the country implied by its dial
 * code. The phone widget always embeds the dial code (e.g. "+919876543210" /
 * "919876543210"), so an incomplete number like "+9179998738" (dial code + only
 * 8 national digits) is correctly rejected.
 */
export const isValidPhoneValue = (value: string | undefined | null): boolean => {
    if (!value) return false;
    const raw = String(value).trim();
    try {
        return isValidPhoneNumber(raw.startsWith('+') ? raw : `+${raw}`);
    } catch {
        return false;
    }
};

/**
 * Imperative validator for plain-state / manual-validation forms.
 * Returns an error message string, or `undefined` when the value is acceptable.
 */
export const validatePhoneField = (
    value: string | undefined | null,
    { required = false, label = DEFAULT_LABEL }: PhoneValidationOptions = {}
): string | undefined => {
    if (isBlankPhone(value)) {
        return required ? `${label} is required` : undefined;
    }
    return isValidPhoneValue(value) ? undefined : invalidMessage(label);
};

/**
 * react-hook-form `rules.validate` function for Controller-based fields on forms
 * that do NOT use a zodResolver. (When a resolver is set, RHF ignores these
 * rules and the resolver's schema governs instead.)
 */
export const phoneValidateRule =
    (options: PhoneValidationOptions = {}) =>
    (value: string | undefined | null): true | string =>
        validatePhoneField(value, options) ?? true;

/** Reusable zod schema for react-hook-form + zodResolver forms. */
export const phoneSchema = ({ required = false, label = DEFAULT_LABEL }: PhoneValidationOptions = {}) => {
    if (required) {
        return z
            .string({ required_error: `${label} is required` })
            .nonempty(`${label} is required`)
            .refine((value) => isValidPhoneValue(value), { message: invalidMessage(label) });
    }
    return z
        .string()
        .refine((value) => isBlankPhone(value) || isValidPhoneValue(value), {
            message: invalidMessage(label),
        })
        .optional();
};
