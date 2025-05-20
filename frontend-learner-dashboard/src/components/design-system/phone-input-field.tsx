// import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
// import { type Control } from "react-hook-form";
// import PhoneInput from "react-phone-input-2";
// import "react-phone-input-2/lib/bootstrap.css";

// interface PhoneInputFieldProps {
//     label: string;
//     name: string;
//     placeholder: string;
//     // eslint-disable-next-line
//     control: any;
//     disabled?: boolean;
//     country?: string;
//     required?: boolean;
//     value?: string;
// }

// const PhoneInputField: React.FC<PhoneInputFieldProps> = ({
//     label,
//     name,
//     placeholder,
//     control,
//     disabled = false,
//     country = "us",
//     required = false,
//     value,
// }) => {
//     return (
//         <FormField
//             control={control as Control}
//             name={name}
//             render={({ field }) => (
//                 <FormItem className="w-96">
//                     <FormLabel>
//                         {label}
//                         {required && <span className="text-danger-600">*</span>}
//                     </FormLabel>
//                     <FormControl>
//                         <PhoneInput
//                             {...field}
//                             country={country}
//                             enableSearch={true}
//                             placeholder={placeholder}
//                             onChange={field.onChange}
//                             inputClass="w-96 h-7"
//                             disabled={disabled}
//                             value={value}
//                         />
//                     </FormControl>
//                     <FormMessage />
//                 </FormItem>
//             )}
//         />
//     );
// };

// export default PhoneInputField;








"use client"

import type React from "react"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { Control } from "react-hook-form"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/bootstrap.css"

interface PhoneInputFieldProps {
  label: string
  name: string
  placeholder: string
  // eslint-disable-next-line
  control: any
  disabled?: boolean
  country?: string
  required?: boolean
  value?: string
  onChange?: (value: string) => void
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
                field.onChange(val)
                if (onChange) onChange(val)
              }}
              inputClass="w-full h-10"
              disabled={disabled}
              value={value || field.value}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export default PhoneInputField
