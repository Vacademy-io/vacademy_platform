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
import { getCachedPreferredCountries } from "@/services/domain-routing";

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
}

const DEFAULT_PREFERRED_COUNTRIES = ["us", "gb", "in", "au"];

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
}) => {
  // Read institute-configured preferred countries from domain routing cache.
  // First entry becomes the default selected country; the full list is used
  // to order options in the country picker dropdown.
  const { effectiveCountry, preferredCountries } = useMemo(() => {
    const cached = getCachedPreferredCountries();
    const list = cached.length > 0 ? cached : DEFAULT_PREFERRED_COUNTRIES;
    return {
      effectiveCountry: country ?? list[0] ?? "us",
      preferredCountries: list,
    };
  }, [country]);

  return (
    <FormField
      control={control as Control}
      name={name}
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
