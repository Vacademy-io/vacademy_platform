import { FormControl, FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Control, FieldValues, Path } from "react-hook-form";

interface FormItemWrapperProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    children?: React.ReactNode;
    className?: string;
}

export const FormItemWrapper = <T extends FieldValues>({
    children,
    control,
    name,
    className,
}: FormItemWrapperProps<T>) => {
    return (
        <FormField
            control={control}
            name={name}
            render={() => (
                <FormItem>
                    <FormControl className={cn("", className)}>{children}</FormControl>
                </FormItem>
            )}
        />
    );
};
