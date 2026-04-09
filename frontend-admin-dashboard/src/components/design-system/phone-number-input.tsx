import React from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';

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
    error?: string;
}

/**
 * Standalone phone number input with country code selector.
 * Works with plain useState (no React Hook Form dependency).
 * Uses react-phone-input-2 internally.
 */
export default function PhoneNumberInput({
    name,
    value,
    onChange,
    label = 'Phone Number',
    required = false,
    placeholder = 'Enter phone number',
    className = '',
    country = 'in',
    disabled = false,
    error,
}: PhoneNumberInputProps) {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <PhoneInput
                country={country}
                enableSearch={true}
                placeholder={placeholder}
                value={value}
                onChange={(phone) => onChange(name, phone)}
                inputClass="!w-full !h-[38px] !text-sm"
                disabled={disabled}
                inputProps={{ name }}
            />
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}
