import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Select,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type Control } from "react-hook-form";

interface Options {
    _id: string | number;
    value: string | number;
    label: string;
}

interface SelectFieldProps {
    className?: string;
    label: string;
    labelStyle?: string;
    name: string;
    options: Options[];
    required?: boolean;
    onSelect?: (value: string) => void;
    // eslint-disable-next-line
    control: any;
    disabled?: boolean;
    selectFieldForInvite?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({
    label,
    labelStyle,
    name,
    options,
    required = false,
    control,
    onSelect,
    disabled = false,
    className,
    selectFieldForInvite = false,
}) => (
    <FormField
        control={control as Control}
        name={name}
        render={({ field }) => {
            // Set the default value to the first option if not already set
            if (!field.value && options && options.length > 0) {
                field.onChange(options[0]?.value.toString());
            }

            return (
                <FormItem
                    className={
                        !selectFieldForInvite ? cn("w-44", className) : cn("flex items-center")
                    }
                >
                    <FormLabel
                        className={labelStyle ? cn("flex items-center", labelStyle) : "w-[330px]"}
                    >
                        {label}
                        {required && <span className="text-red-500">*</span>}
                    </FormLabel>
                    <FormControl>
                        <Select
                            onValueChange={(value) => {
                                field.onChange(value);
                                if (onSelect !== null && onSelect !== undefined) {
                                    onSelect(value);
                                }
                            }}
                            disabled={disabled}
                            value={field.value}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${label}`} />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                {options.map((option) => (
                                    <SelectItem
                                        className={className}
                                        key={option._id}
                                        value={option?.value?.toString()}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            );
        }}
    />
);

export default SelectField;
