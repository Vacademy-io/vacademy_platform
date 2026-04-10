import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Control } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';
import { getCachedPreferredCountries } from '@/services/domain-routing';

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

const DEFAULT_PREFERRED_COUNTRIES = ['us', 'gb', 'in', 'au'];

const PhoneInputField = ({
    label,
    name,
    placeholder,
    control,
    disabled = false,
    country,
    labelStyle,
    required = false,
}: PhoneInputFieldProps) => {
    // Read institute-configured preferred countries from cached domain routing.
    // The first entry becomes the default selected country in the input, and the
    // full list determines the order of country options shown in the picker.
    const { effectiveCountry, preferredCountries } = useMemo(() => {
        const cached = getCachedPreferredCountries();
        const list = cached.length > 0 ? cached : DEFAULT_PREFERRED_COUNTRIES;
        return {
            effectiveCountry: country ?? list[0] ?? 'us',
            preferredCountries: list,
        };
    }, [country]);

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
                            country={effectiveCountry}
                            preferredCountries={preferredCountries}
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
