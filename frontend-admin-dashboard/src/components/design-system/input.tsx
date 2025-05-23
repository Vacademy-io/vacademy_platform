import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormInputProps } from "./utils/types/input-types";
import { InputErrorProps } from "./utils/types/input-types";
import { Label } from "../ui/label";
import { EyeSlash, WarningCircle, Eye } from "@phosphor-icons/react";

const inputSizeVariants = {
    large: "w-60 h-10 py-2 px-3 text-subtitle",
    medium: "w-60 h-9 py-2 px-3 text-body",
    small: "w-60 h-6 p-2 text-caption",
} as const;

const InputError = ({ errorMessage }: InputErrorProps) => {
    return (
        <div className="flex items-center gap-1 pl-1 text-body font-regular text-danger-600">
            <span>
                <WarningCircle />
            </span>
            <span className="mt-[3px]">{errorMessage}</span>
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
                    <Label className={`text-subtitle font-regular ${labelStyle}`}>
                        {label}
                        {required && <span className="text-subtitle text-danger-600">*</span>}
                    </Label>
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
                            inputType === "password" ? "pr-10" : "",
                            "text-subtitle text-neutral-600 shadow-none placeholder:text-body placeholder:font-regular hover:border-primary-200 focus:border-primary-500 focus-visible:ring-0",
                            className,
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                        >
                            {showPassword ? (
                                <Eye className="size-4 text-neutral-600" />
                            ) : (
                                <EyeSlash className="size-4 text-neutral-600" />
                            )}
                        </button>
                    )}
                </div>
            </div>
            {error && <InputError errorMessage={error} />}
        </div>
    );
};
