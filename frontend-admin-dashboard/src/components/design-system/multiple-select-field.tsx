import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CaretDown, CaretUp, Check } from 'phosphor-react';
import { Badge } from '../ui/badge';
import { FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { type Control } from 'react-hook-form';
import { cn } from '@/lib/utils';

interface Options {
    _id: string | number;
    value: string | number;
    label: string;
}

interface SelectFieldProps {
    form: any; // eslint-disable-line
    className?: string;
    label: string;
    labelStyle?: string;
    name: string;
    options: Options[];
    required?: boolean;
    control: any; // eslint-disable-line
}

export default function MultiSelectDropdown({
    form,
    label,
    labelStyle,
    name,
    options,
    required = false,
    control,
    className,
}: SelectFieldProps) {
    const [selectedOptions, setSelectedOptions] = useState<(string | number)[]>([
        ...form.getValues(name),
    ]);
    const [tags, setTags] = useState<(string | undefined)[]>([]);

    const [isOpen, setIsOpen] = useState(false);

    const toggleSelection = (value: string | number) => {
        setSelectedOptions((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
        setTags(
            selectedOptions.map((option) => options.find((opt) => opt.value === option)?.label)
        );
    };

    useEffect(() => {
        form.setValue(name, selectedOptions);
        setTags(
            selectedOptions.map((option) => options.find((opt) => opt.value === option)?.label)
        );
    }, [selectedOptions]);

    useEffect(() => {
        setSelectedOptions(form.getValues(name));
        setTags(
            selectedOptions.map((option) => options.find((opt) => opt.value === option)?.label)
        );
    }, []);
    return (
        <>
            <FormField
                control={control as Control}
                name={name}
                render={({ field }) => {
                    // Set the default value to the first option if not already set
                    if (!field.value && options && options.length > 0) {
                        field.onChange(options[0]?.value.toString());
                    }

                    return (
                        <div>
                            <FormItem className={cn('w-44', className)}>
                                <FormLabel className={labelStyle}>
                                    {label}
                                    {required && <span className="text-red-500">*</span>}
                                </FormLabel>
                                <FormControl>
                                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                                        <PopoverTrigger>
                                            <div className="flex w-96 items-center justify-between rounded-lg border px-3 py-2">
                                                <h1 className="text-sm">Select options</h1>
                                                {isOpen ? <CaretUp /> : <CaretDown />}
                                            </div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-1">
                                            {options.map((option) => (
                                                <div
                                                    key={option.value}
                                                    className="flex w-80 cursor-pointer justify-between rounded-lg p-2 hover:bg-neutral-100"
                                                    onClick={() => toggleSelection(option.value)}
                                                >
                                                    <label className="text-sm">
                                                        {option.label}
                                                    </label>
                                                    {selectedOptions.includes(option.value) && (
                                                        <Check size={18} />
                                                    )}
                                                </div>
                                            ))}
                                        </PopoverContent>
                                    </Popover>
                                </FormControl>
                            </FormItem>
                            <div className="mt-4 flex flex-wrap justify-start gap-4">
                                {tags.map((value, index) => (
                                    <Badge key={index} className="bg-[#F4F9FF] px-2 py-1">
                                        {value}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    );
                }}
            />
        </>
    );
}
