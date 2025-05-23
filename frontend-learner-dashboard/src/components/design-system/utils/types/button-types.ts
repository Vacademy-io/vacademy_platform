import { ButtonProps } from "@/components/ui/button";

export interface myButtonProps {
    className: string;
    type: string;
    scale: string;
}

// Types
type ButtonVariantType = "primary" | "secondary" | "text";
type ButtonScale = "large" | "medium" | "small";
type ButtonLayoutVariant = "default" | "icon" | "floating" | "extendedFloating";

// Extend from Shadcn ButtonProps instead of HTML button attributes
export interface MyButtonProps extends Omit<ButtonProps, "variant"> {
    className?: string;
    buttonType?: ButtonVariantType; // renamed from 'type' to avoid confusion
    scale?: ButtonScale;
    layoutVariant?: ButtonLayoutVariant; // renamed from 'variant' to avoid confusion with Shadcn's variant
    children?: React.ReactNode;
    disable?: boolean;
}
