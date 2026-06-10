"use client";

import type React from "react";
import { useMemo } from "react";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import type { Control } from "react-hook-form";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/bootstrap.css";
import { getPreferredPhoneCountries } from "@/services/domain-routing";
import { phoneValidateRule } from "@/lib/phone-validation";

interface PhoneInputFieldProps {
  label: string;
  name: string;
  placeholder: string;
  // eslint-disable-next-line
  control: any;
  disabled?: boolean;
  country?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  /**
   * Country-aware validation is on by default. It only takes effect on forms
   * that do NOT use a zodResolver (RHF ignores field rules when a resolver is
   * set — those forms validate via their schema instead). Pass `false` to opt out.
   */
  validate?: boolean;
}

const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
  label,
  name,
  placeholder,
  control,
  disabled = false,
  country,
  required = false,
  value,
  onChange,
  validate = true,
}) => {
  // Read institute-configured preferred countries from domain routing cache.
  // First entry becomes the default selected country; the full list is used
  // to order options in the country picker dropdown. An explicit `country`
  // prop still wins for intentional callers.
  const { effectiveCountry, preferredCountries } = useMemo(() => {
    const { defaultCountry, preferredCountries } = getPreferredPhoneCountries();
    return {
      effectiveCountry: country ?? defaultCountry,
      preferredCountries,
    };
  }, [country]);

  return (
    <FormField
      control={control as Control}
      name={name}
      rules={validate ? { validate: phoneValidateRule({ required, label }) } : undefined}
      render={({ field }) => (
        <FormItem className="!w-full">
          <FormLabel>
            {label}
            {required && <span className="text-danger-600">*</span>}
          </FormLabel>
          <FormControl>
            <PhoneInput
              {...field}
              country={effectiveCountry}
              enableSearch={true}
              placeholder={placeholder}
              onChange={(val) => {
                // Ensure the value includes the country code with + prefix
                const formattedValue = val.startsWith("+") ? val : `+${val}`;
                field.onChange(formattedValue);
                if (onChange) onChange(formattedValue);
              }}
              inputClass="!w-full h-10 !rounded-md !border-input"
              buttonClass="!rounded-l-md !border-input"
              disabled={disabled}
              value={value || field.value}
              countryCodeEditable={false}
              enableAreaCodes={false}
              disableCountryGuess={false}
              preferredCountries={preferredCountries}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default PhoneInputField;
