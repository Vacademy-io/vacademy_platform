import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CaretDown, CaretUp, Check } from "phosphor-react";
import { Badge } from "../ui/badge";
import { FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { type Control } from "react-hook-form";
import { cn } from "@/lib/utils";
import { MyDialog } from "./dialog";
import { MyButton } from "./button";
import { Input } from "../ui/input";

interface Option {
    id: string;
    name: string;
    days: number;
}

interface SessionWithAccessDaysProps {
    form: any; // eslint-disable-line
    className?: string;
    label: string;
    labelStyle?: string;
    name: string;
    options: Option[];
    required?: boolean;
    control: any; // eslint-disable-line
}

interface SelectedOption {
    id: string;
    days: number;
}

export function SessionWithAccessDays({
    form,
    label,
    labelStyle,
    name,
    options,
    required = false,
    control,
    className,
}: SessionWithAccessDaysProps) {
    const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedOptionForDays, setSelectedOptionForDays] = useState<Option | null>(null);
    const [accessDays, setAccessDays] = useState<string>("");

    const toggleSelection = (option: Option) => {
        if (selectedOptions.some((item) => item.id === option.id)) {
            setSelectedOptions((prev) => prev.filter((item) => item.id !== option.id));
        } else {
            setSelectedOptionForDays(option);
            setAccessDays("");
        }
    };

    const handleSetAccessDays = () => {
        if (selectedOptionForDays && accessDays) {
            const days = parseInt(accessDays);
            if (!isNaN(days) && days > 0) {
                setSelectedOptions((prev) => {
                    const existingIndex = prev.findIndex(
                        (item) => item.id === selectedOptionForDays.id,
                    );
                    if (existingIndex >= 0) {
                        const newOptions = [...prev];
                        newOptions[existingIndex] = { id: selectedOptionForDays.id, days };
                        return newOptions;
                    }
                    return [...prev, { id: selectedOptionForDays.id, days }];
                });
                setSelectedOptionForDays(null);
                setAccessDays("");
            }
        }
    };

    useEffect(() => {
        form.setValue(name, selectedOptions);
    }, [selectedOptions]);

    useEffect(() => {
        setSelectedOptions(form.getValues(name) || []);
    }, []);

    return (
        <>
            <FormField
                control={control as Control}
                name={name}
                render={() => {
                    return (
                        <div>
                            <FormItem className={cn("w-44", className)}>
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
                                                    key={option.id}
                                                    className="flex w-80 cursor-pointer justify-between rounded-lg p-2 hover:bg-neutral-100"
                                                    onClick={() => toggleSelection(option)}
                                                >
                                                    <label className="text-sm">{option.name}</label>
                                                    {selectedOptions.some(
                                                        (item) => item.id === option.id,
                                                    ) && <Check size={18} />}
                                                </div>
                                            ))}
                                        </PopoverContent>
                                    </Popover>
                                </FormControl>
                            </FormItem>
                            <div className="mt-4 flex flex-wrap justify-start gap-4">
                                {selectedOptions.map((selected) => {
                                    const option = options.find((opt) => opt.id === selected.id);
                                    return (
                                        <Badge key={selected.id} className="bg-[#F4F9FF] px-2 py-1">
                                            {option?.name} ({selected.days} days)
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }}
            />

            <MyDialog
                open={!!selectedOptionForDays}
                onOpenChange={(open) => !open && setSelectedOptionForDays(null)}
                heading="Set Access Days"
                dialogWidth="w-[400px]"
            >
                <div className="flex flex-col gap-4 p-4">
                    <div className="text-sm">
                        Set access days for: {selectedOptionForDays?.name}
                    </div>
                    <Input
                        type="number"
                        min="1"
                        value={accessDays}
                        onChange={(e) => setAccessDays(e.target.value)}
                        placeholder="Enter number of days"
                    />
                    <div className="flex items-center justify-between">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setSelectedOptionForDays(null)}
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            onClick={handleSetAccessDays}
                            disabled={!accessDays || parseInt(accessDays) <= 0}
                        >
                            Set Days
                        </MyButton>
                    </div>
                </div>
            </MyDialog>
        </>
    );
}
