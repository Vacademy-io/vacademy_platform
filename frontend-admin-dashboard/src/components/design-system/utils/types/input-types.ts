export interface InputErrorProps {
    errorMessage?: string;
}

// FormInput Props
export type InputSize = "small" | "medium" | "large";

export interface FormInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
    inputType?: string;
    inputPlaceholder?: string;
    input: string | undefined;
    onChangeFunction: (event: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string | null;
    required?: boolean;
    className?: string;
    size?: "large" | "medium" | "small";
    disabled?: boolean;
    label?: string;
    labelStyle?: string;
}
