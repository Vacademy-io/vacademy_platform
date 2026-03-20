import { cn } from '@/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Control } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';

interface PhoneInputFieldProps {
    label: string;
    name: string;
    placeholder: string;
    control: Control<any>;
    disabled?: boolean;
    country?: string;
    required?: boolean;
    labelStyle?: string;
}

const PhoneInputField = ({
    label,
    name,
    placeholder,
    control,
    disabled = false,
    country = 'us',
    labelStyle,
    required = false,
}: PhoneInputFieldProps) => {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>
                        <span className={cn(labelStyle)}>{label}</span>
                        {required && <span className="text-danger-600">*</span>}
                    </FormLabel>
                    <FormControl>
                        <PhoneInput
                            country={country}
                            enableSearch={true}
                            placeholder={placeholder}
                            value={field.value}
                            onChange={field.onChange}
                            inputClass="!w-full h-7"
                            disabled={disabled}
                            inputProps={{
                                name,
                            }}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
};

export default PhoneInputField;
