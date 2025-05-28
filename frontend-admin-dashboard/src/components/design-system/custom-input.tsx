import { Control, FieldValues, Path } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

interface CustomInputProps<T extends FieldValues> {
    control: Control<T>; // React Hook Form's control type for generic forms
    name: Path<T>; // Generic field name based on form schema
    label: string; // Label for the input field
    placeholder?: string; // Placeholder for the input field
    required?: boolean; // Determines if the input is required
    className?: string;
}

const CustomInput = <T extends FieldValues>({
    control,
    name,
    label,
    placeholder = "",
    required = false,
    className = "",
    ...props
}: CustomInputProps<T>) => {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    {label && (
                        <FormLabel>
                            {label}
                            {required && <span className="text-red-500">*</span>}
                        </FormLabel>
                    )}
                    <FormControl>
                        <Input
                            {...field}
                            placeholder={placeholder}
                            required={required}
                            className={className}
                            {...props}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};

export default CustomInput;
