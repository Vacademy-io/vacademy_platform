import React, { useMemo, useState } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';
import { getPreferredPhoneCountries } from '@/services/domain-routing';
import { validatePhoneField } from '@/lib/phone-validation';

interface PhoneNumberInputProps {
    name: string;
    value: string;
    onChange: (name: string, value: string) => void;
    label?: string;
    required?: boolean;
    placeholder?: string;
    className?: string;
    country?: string;
    disabled?: boolean;
    /** External error message. When provided, it overrides the built-in validation message. */
    error?: string;
    /**
     * Country-aware validation is on by default; the message shows once the field
     * is blurred. Pass `false` to opt out. Note this only surfaces the error — the
     * parent's submit handler should also call `validatePhoneField` to block submit.
     */
    validate?: boolean;
}

/**
 * Standalone phone number input with country code selector.
 * Works with plain useState (no React Hook Form dependency).
 * Uses react-phone-input-2 internally.
 *
 * Defaults the selected country and orders the picker from the institute's
 * configured preferred countries; an explicit `country` prop overrides this.
 */
export default function PhoneNumberInput({
    name,
    value,
    onChange,
    label = 'Phone Number',
    required = false,
    placeholder = 'Enter phone number',
    className = '',
    country,
    disabled = false,
    error,
    validate = true,
}: PhoneNumberInputProps) {
    const [touched, setTouched] = useState(false);
    const { effectiveCountry, preferredCountries } = useMemo(() => {
        const { defaultCountry, preferredCountries } = getPreferredPhoneCountries();
        return {
            effectiveCountry: country ?? defaultCountry,
            preferredCountries,
        };
    }, [country]);

    // External error wins; otherwise surface the country-aware message once blurred.
    const displayError =
        error ??
        (validate && touched ? validatePhoneField(value, { required, label }) : undefined);

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <PhoneInput
                country={effectiveCountry}
                preferredCountries={preferredCountries}
                enableSearch={true}
                placeholder={placeholder}
                value={value}
                onChange={(phone) => onChange(name, phone)}
                onBlur={() => setTouched(true)}
                inputClass="!w-full !h-10 !text-sm"
                disabled={disabled}
                inputProps={{ name }}
            />
            {displayError && <span className="text-xs text-red-500">{displayError}</span>}
        </div>
    );
}
