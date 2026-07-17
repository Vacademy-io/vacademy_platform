import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeSlash, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { FormInputProps } from "./utils/types/input-types";
import { InputErrorProps } from "./utils/types/input-types";
import { FormLabel } from "../ui/form";

const inputSizeVariants = {
  large: "h-10 py-2 px-3 text-subtitle",
  medium: "h-9 py-2 px-3 text-body",
  small: "h-6 py-2 px-2 text-caption",
} as const;

const InputError = ({ errorMessage }: InputErrorProps) => {
  return (
    <div className="flex items-center gap-1 ps-1 text-body font-regular text-danger-600">
      <span>
        <XCircle />
      </span>
      <span className="mt-0.5">{errorMessage}</span>
    </div>
  );
};

export const MyInput = ({
  inputType,
  inputPlaceholder,
  input,
  onChangeFunction,
  error,
  required,
  className,
  size = "medium",
  disabled,
  label,
  labelStyle,
  ...props
}: FormInputProps) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        {label && (
          <FormLabel className={`${labelStyle}`}>
            {label}
            {required && (
              <span className="text-subtitle text-danger-600">*</span>
            )}
          </FormLabel>
        )}
        <div className="relative">
          <Input
            disabled={disabled}
            type={
              inputType === "password"
                ? showPassword
                  ? "text"
                  : "password"
                : inputType
            }
            placeholder={inputPlaceholder}
            className={cn(
              inputSizeVariants[size],
              error ? "border-danger-600" : "border-neutral-300",
              inputType === "password" ? "pe-10" : "",
              "text-subtitle text-neutral-600 shadow-none placeholder:text-body placeholder:font-regular hover:border-primary-200 focus:border-primary-500 focus-visible:ring-0",
              className
            )}
            value={input}
            onChange={onChangeFunction}
            required={required}
            {...props}
          />
          {inputType === "password" && (
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
            >
              {showPassword ? (
                <EyeSlash className="size-4 text-neutral-600" />
              ) : (
                <Eye className="size-4 text-neutral-600" />
              )}
            </button>
          )}
        </div>
      </div>
      {error && <InputError errorMessage={error} />}
    </div>
  );
};
