import React, { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp, Check, Plus } from '@phosphor-icons/react';

interface CampaignTypeOption {
    value: string;
    label: string;
}

interface CampaignTypeDropdownProps {
    value?: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    initialOptions?: CampaignTypeOption[];
}

const defaultOptions: CampaignTypeOption[] = [
    { value: 'Website', label: 'Website' },
    { value: 'Google Ads', label: 'Google Ads' },
    { value: 'Social Media', label: 'Social Media' },
];

const CampaignTypeDropdown: React.FC<CampaignTypeDropdownProps> = ({
    value = '',
    onChange,
    error,
    placeholder = 'Select campaign type',
    initialOptions = defaultOptions,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<CampaignTypeOption[]>(initialOptions);
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const customInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsAddingCustom(false);
                setCustomValue('');
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isAddingCustom && customInputRef.current) {
            customInputRef.current.focus();
        }
    }, [isAddingCustom]);

    useEffect(() => {
        if (
            value &&
            !options.some((option) => option.value.toLowerCase() === value.toLowerCase())
        ) {
            setOptions((prev) => [...prev, { value, label: value }]);
        }
    }, [value, options]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setIsAddingCustom(false);
        setCustomValue('');
    };

    const handleCustomSave = () => {
        const trimmed = customValue.trim();
        if (!trimmed) return;

        const exists = options.some(
            (option) => option.value.toLowerCase() === trimmed.toLowerCase()
        );

        if (!exists) {
            setOptions((prev) => [...prev, { value: trimmed, label: trimmed }]);
        }

        handleSelect(trimmed);
    };

    const displayLabel = (() => {
        if (value) {
            const found = options.find(
                (option) => option.value.toLowerCase() === value.toLowerCase()
            );
            return found?.label || value;
        }
        return placeholder;
    })();

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => {
                    setIsOpen((prev) => !prev);
                    setIsAddingCustom(false);
                    setCustomValue('');
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
                    error ? 'border-danger-600' : 'border-neutral-300 hover:border-primary-200'
                } ${value ? 'text-neutral-600' : 'text-neutral-400'}`}
            >
                <span className="truncate text-left">{displayLabel}</span>
                <div className="ml-2 shrink-0">
                    {isOpen ? (
                        <CaretUp className="size-[18px] text-neutral-600" />
                    ) : (
                        <CaretDown className="size-[18px] text-neutral-600" />
                    )}
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-30 mt-2 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
                    <div className="max-h-60 overflow-y-auto py-1">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50 ${
                                    value?.toLowerCase() === option.value.toLowerCase()
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'text-neutral-700'
                                }`}
                            >
                                <span>{option.label}</span>
                                {value?.toLowerCase() === option.value.toLowerCase() && (
                                    <Check className="size-4 text-primary-500" />
                                )}
                            </button>
                        ))}

                        <div className="my-1 border-t border-neutral-100" />

                        {!isAddingCustom ? (
                            <button
                                type="button"
                                onClick={() => setIsAddingCustom(true)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary-600 transition-colors hover:bg-primary-50"
                            >
                                <Plus className="size-4" />
                                Add custom Enquiry type
                            </button>
                        ) : (
                            <div className="space-y-2 px-3 py-2">
                                <input
                                    ref={customInputRef}
                                    type="text"
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value)}
                                    placeholder="Enter campaign type"
                                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddingCustom(false);
                                            setCustomValue('');
                                        }}
                                        className="text-sm text-neutral-500 hover:text-neutral-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCustomSave}
                                        className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <span className="mt-1 block text-sm text-red-500">{error}</span>
            )}
        </div>
    );
};

export default CampaignTypeDropdown;

