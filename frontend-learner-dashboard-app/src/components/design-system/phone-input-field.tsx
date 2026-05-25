"use client";

import type React from "react";

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
  labelClassName?: string;
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
  labelClassName,
}) => {
  // Read institute-configured preferred countries from domain routing cache on
  // every render — the cache populates async on app boot, so memoising would
  // pin the dropdown to whatever was cached at mount. An explicit `country`
  // prop still wins for intentional callers.
  const { defaultCountry, preferredCountries } = getPreferredPhoneCountries();
  const effectiveCountry = country ?? defaultCountry;

  return (
    <FormField
      control={control as Control}
      name={name}
      render={({ field }) => (
        <FormItem className="!w-full">
          <FormLabel className={labelClassName}>
            {label}
            {required && <span className="text-danger-600">*</span>}
          </FormLabel>
          <FormControl>
            {/* `key` forces a remount when the institute's preferred country
                becomes available after async domain-routing resolution —
                react-phone-input-2 reads `country` only on mount. */}
            <PhoneInput
              key={effectiveCountry}
              {...field}
              country={effectiveCountry}
              enableSearch={true}
              placeholder={placeholder}
              onChange={(val) => {
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
