import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Control } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/bootstrap.css';
import { getPreferredPhoneCountries } from '@/services/domain-routing';
import { phoneValidateRule } from '@/lib/phone-validation';

interface PhoneInputFieldProps {
    label: string;
    name: string;
    placeholder: string;
    control: Control<any>;
    disabled?: boolean;
    country?: string;
    required?: boolean;
    labelStyle?: string;
    /**
     * Country-aware validation is on by default. It only takes effect on forms
     * that do NOT use a zodResolver (RHF ignores field rules when a resolver is
     * set — those forms validate via their schema instead). Pass `false` to opt out.
     */
    validate?: boolean;
}

const PhoneInputField = ({
    label,
    name,
    placeholder,
    control,
    disabled = false,
    country,
    labelStyle,
    required = false,
    validate = true,
}: PhoneInputFieldProps) => {
    // Read institute-configured preferred countries from cached domain routing.
    // The first entry becomes the default selected country in the input, and the
    // full list determines the order of country options shown in the picker.
    // An explicit `country` prop still wins for intentional callers.
    const { effectiveCountry, preferredCountries } = useMemo(() => {
        const { defaultCountry, preferredCountries } = getPreferredPhoneCountries();
        return {
            effectiveCountry: country ?? defaultCountry,
            preferredCountries,
        };
    }, [country]);

    return (
        <FormField
            control={control}
            name={name}
            rules={validate ? { validate: phoneValidateRule({ required, label }) } : undefined}
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
