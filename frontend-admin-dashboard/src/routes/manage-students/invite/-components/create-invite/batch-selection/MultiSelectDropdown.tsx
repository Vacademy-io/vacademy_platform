import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CaretDown, CaretUp, Check, X } from 'phosphor-react';

interface Option {
    id: string;
    name: string;
}

interface MultiSelectDropdownProps {
    label: string;
    options: Option[];
    selectedValues: string[];
    onChange: (selectedIds: string[]) => void;
    className?: string;
    required?: boolean;
}

export default function MultiSelectDropdown({
    label,
    options,
    selectedValues,
    onChange,
    className,
    required = false,
}: MultiSelectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Find selected options objects based on ids
    const selectedOptions = options.filter((opt) => selectedValues.includes(opt.id));

    const toggleSelection = (option: Option) => {
        if (selectedValues.includes(option.id)) {
            onChange(selectedValues.filter((id) => id !== option.id));
        } else {
            onChange([...selectedValues, option.id]);
        }
    };

    const clearSelections = () => {
        onChange([]);
    };

    return (
        <div className={className}>
            <div className="mb-2 flex items-center gap-3">
                <label className="text-sm font-medium">
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </label>
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger>
                        <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2">
                            <h1 className="text-sm">Select options</h1>
                            {isOpen ? <CaretUp /> : <CaretDown />}
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-1">
                        <div className="mb-2 flex justify-end">
                            <button
                                type="button"
                                className="flex items-center text-xs text-neutral-500 hover:text-neutral-700"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearSelections();
                                }}
                            >
                                <X size={14} className="mr-1" />
                                Clear selection
                            </button>
                        </div>
                        {options.map((option) => (
                            <div
                                key={option.id}
                                className="flex cursor-pointer justify-between rounded-lg bg-white p-2 hover:bg-neutral-100"
                                onClick={() => toggleSelection(option)}
                            >
                                <label className="text-sm">{option.name}</label>
                                {selectedValues.includes(option.id) && <Check size={18} />}
                            </div>
                        ))}
                    </PopoverContent>
                </Popover>
            </div>
            <div className="flex flex-wrap justify-start gap-4">
                {selectedOptions.map((option) => (
                    <div
                        key={option.id}
                        className="rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1 text-body text-neutral-600"
                    >
                        {option.name}
                    </div>
                ))}
            </div>
        </div>
    );
}
