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

const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
  label,
  name,
  placeholder,
  control,
  disabled = false,
  country = "us",
  required = false,
  value,
  onChange,
}) => {
  return (
    <FormField
      control={control as Control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel>
            {label}
            {required && <span className="text-danger-600">*</span>}
          </FormLabel>
          <FormControl>
            <PhoneInput
              {...field}
              country={country}
              enableSearch={true}
              placeholder={placeholder}
              onChange={(val) => {
                // Ensure the value includes the country code with + prefix
                const formattedValue = val.startsWith("+") ? val : `+${val}`;
                field.onChange(formattedValue);
                if (onChange) onChange(formattedValue);
              }}
              inputClass="w-full h-10 !rounded-md !border-input"
              buttonClass="!rounded-l-md !border-input"
              disabled={disabled}
              value={value || field.value}
              countryCodeEditable={false}
              enableAreaCodes={true}
              disableCountryGuess={false}
              preferredCountries={["us", "gb", "in"]}
              inputProps={{
                maxLength: 15, // Maximum length including country code
                minLength: 11, // Minimum length including country code
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
