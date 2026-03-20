import React, { useState, useRef, useEffect } from 'react';
import { X } from '@phosphor-icons/react';

export interface MultiSelectOption {
    id: string | number;
    name: string;
}

interface MultiSelectDropdownProps {
    options: MultiSelectOption[];
    selected: MultiSelectOption[];
    onChange: (selected: MultiSelectOption[]) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    options,
    selected,
    onChange,
    placeholder = 'Select...',
    disabled = false,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (option: MultiSelectOption) => {
        if (!selected) {
            onChange([option]);
            return;
        }
        if (!selected.find((item) => item.id === option.id)) {
            onChange([...selected, option]);
        }
    };

    const handleRemove = (option: MultiSelectOption) => {
        onChange(selected.filter((item) => item.id !== option.id));
    };

    const availableOptions = options.filter(
        (option) => !selected?.some((item) => item.id === option.id)
    );

    return (
        <div className={`relative flex items-center gap-2 ${className}`} ref={dropdownRef}>
            <div className="flex items-center gap-1">
                {selected?.map((item) => (
                    <span
                        key={item.id}
                        className="text-primary-700 mr-1 flex items-center gap-1 rounded bg-primary-50 px-2 py-1 text-xs font-medium"
                    >
                        {item.name}
                        <button
                            type="button"
                            className="ml-1 focus:outline-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(item);
                            }}
                            aria-label={`Remove ${item.name}`}
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
            </div>
            <div>
                <button
                    type="button"
                    className={`flex flex-wrap items-center gap-2 rounded bg-white text-left transition-all  focus:border-none active:border-none  ${disabled ? 'cursor-not-allowed bg-neutral-100' : ''}`}
                    onClick={() => !disabled && setIsOpen((open) => !open)}
                    disabled={disabled}
                >
                    <p className="text-sm text-primary-500">{placeholder}</p>
                </button>
                {isOpen && (
                    <div className="absolute z-10 mt-1 max-h-60 w-max overflow-auto rounded-lg bg-white shadow-lg">
                        {availableOptions?.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-neutral-400">No teachers</div>
                        ) : (
                            availableOptions?.map((option) => (
                                <div
                                    key={option.id}
                                    className="cursor-pointer px-4 py-2 text-sm text-neutral-700 hover:bg-primary-50"
                                    onClick={() => handleSelect(option)}
                                >
                                    {option.name}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MultiSelectDropdown;
