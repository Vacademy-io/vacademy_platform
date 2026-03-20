import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '@/utils/template-validation';

interface EmailSendButtonProps {
    onClick: () => void;
    isSending: boolean;
    validationResult: ValidationResult | null;
    disabled?: boolean;
    className?: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    children?: React.ReactNode;
}

export const EmailSendButton: React.FC<EmailSendButtonProps> = ({
    onClick,
    isSending,
    validationResult,
    disabled = false,
    className = '',
    variant = 'default',
    size = 'default',
    children
}) => {
    const getButtonState = () => {
        if (isSending) {
            return {
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
                text: 'Sending...',
                disabled: true,
                variant: 'default' as const
            };
        }

        if (validationResult) {
            if (validationResult.canSend) {
                return {
                    icon: <CheckCircle2 className="h-4 w-4" />,
                    text: 'Send Email',
                    disabled: false,
                    variant: 'default' as const
                };
            } else if (validationResult.missingVariables.length > 0) {
                return {
                    icon: <AlertTriangle className="h-4 w-4" />,
                    text: 'Cannot Send',
                    disabled: true,
                    variant: 'destructive' as const
                };
            } else if (validationResult.warnings.length > 0) {
                return {
                    icon: <AlertTriangle className="h-4 w-4" />,
                    text: 'Send with Warnings',
                    disabled: false,
                    variant: 'outline' as const
                };
            }
        }

        return {
            icon: <Send className="h-4 w-4" />,
            text: 'Send Email',
            disabled: disabled,
            variant: variant
        };
    };

    const buttonState = getButtonState();

    return (
        <Button
            onClick={onClick}
            disabled={buttonState.disabled || disabled}
            variant={buttonState.variant}
            size={size}
            className={`${className} ${isSending ? 'cursor-not-allowed' : ''}`}
        >
            {buttonState.icon}
            {children || buttonState.text}
        </Button>
    );
};
