import React from 'react';
import { ButtonProps } from '@/components/ui/button';

export interface myButtonProps {
    className: string;
    type: string;
    scale: string;
}

// Types
type ButtonVariantType = 'primary' | 'secondary' | 'text';
export type ButtonScale = 'large' | 'medium' | 'small';
type ButtonLayoutVariant = 'default' | 'icon' | 'floating' | 'extendedFloating';

// Extend from Shadcn ButtonProps instead of HTML button attributes
export interface MyButtonProps extends Omit<ButtonProps, 'variant'> {
    className?: string;
    buttonType?: ButtonVariantType;
    scale?: ButtonScale;
    layoutVariant?: ButtonLayoutVariant;
    children?: React.ReactNode;
    disable?: boolean;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'button' | 'submit' | 'reset';

    /**
     * Optional async click handler. When provided, the button automatically:
     * 1. Disables immediately on click (prevents double-submit)
     * 2. Shows a loading spinner
     * 3. Re-enables when the async operation completes
     * 
     * Note: If both onClick and onAsyncClick are provided, onAsyncClick takes precedence.
     */
    onAsyncClick?: (event: React.MouseEvent<HTMLButtonElement>) => Promise<void>;

    /**
     * Optional text to show while async operation is in progress.
     * Only used when onAsyncClick is provided.
     */
    loadingText?: string;
}

