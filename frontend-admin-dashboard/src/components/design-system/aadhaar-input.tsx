import React from 'react';
import { formatAadhaar, getAadhaarDigits, isValidAadhaar } from '@/utils/form-validation';

interface AadhaarInputProps {
    name: string;
    value: string;
    onChange: (name: string, value: string) => void;
    label?: string;
    required?: boolean;
    placeholder?: string;
    className?: string;
    error?: string;
}

/**
 * Reusable Aadhaar number input with auto-formatting (XXXX-XXXX-XXXX).
 * Stores raw 12-digit value, displays formatted.
 * Works with plain useState (no React Hook Form dependency).
 */
export default function AadhaarInput({
    name,
    value,
    onChange,
    label = 'Aadhaar Number',
    required = false,
    placeholder = 'XXXX-XXXX-XXXX',
    className = '',
    error,
}: AadhaarInputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Only allow digits and dashes (dashes are auto-inserted)
        const digits = raw.replace(/\D/g, '').slice(0, 12);
        onChange(name, digits);
    };

    const displayValue = formatAadhaar(value || '');
    const digits = getAadhaarDigits(value || '');
    const showError = error || (digits.length > 0 && digits.length < 12 && !isValidAadhaar(value || ''));

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label className="text-sm font-medium text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <input
                type="text"
                name={name}
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                maxLength={14} // 12 digits + 2 dashes
                inputMode="numeric"
                className={`rounded-md border px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 ${
                    showError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-300'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                }`}
            />
            {typeof error === 'string' && error && (
                <span className="text-xs text-red-500">{error}</span>
            )}
        </div>
    );
}
