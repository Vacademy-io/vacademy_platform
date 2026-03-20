import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MyButtonProps } from './utils/types/button-types';
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

// Button Variants Configuration
const myButtonVariants = {
    base: 'font-normal shadow-none disabled:cursor-not-allowed transition-colors text-subtitle font-semibold',
    types: {
        primary:
            'bg-primary-500 !text-neutral-50 font-semibold hover:bg-primary-400 active:bg-primary-400 disabled:bg-primary-300 ',
        secondary:
            'bg-none font-regular border-neutral-300 border !text-neutral-600 hover:border-primary-500 hover:bg-primary-50/30 active:border-primary-500 active:bg-primary-50/80 disabled:text-[#7f7f7f] disabled:bg-white disabled:border-neutral-200',
        text: 'shadow-none bg-transparent text-primary-500 disabled:text-neutral-300 disabled:bg-transparent',
    },
    textStyles: {
        large: 'text-subtitle font-regular',
        medium: 'text-body font-regular',
        small: 'text-caption font-regular',
    },
    scales: {
        default: {
            large: 'min-w-60 h-10 px-4 text-subtitle ',
            medium: 'min-w-[140px] h-9 px-3 text-body ',
            small: 'min-w-[83px] h-6 px-2 text-caption',
        },
        icon: {
            large: 'w-10 h-10 !p-0',
            medium: 'w-9 h-9 !p-0',
            small: 'w-6 h-6 !p-0',
        },
        floating: {
            large: 'w-24 h-24 rounded-full',
            medium: 'w-14 h-14 rounded-full',
            small: 'w-10 h-10 rounded-full',
        },
        extendedFloating: {
            large: 'w-24 h-24 rounded-full',
            medium: 'w-24 h-14 rounded-full px-4',
            small: 'w-[71px] h-10 rounded-full px-3',
        },
    },
} as const;

// Button Component
export const MyButton = React.forwardRef<HTMLButtonElement, MyButtonProps>(
    (
        {
            className,
            buttonType = 'primary',
            scale = 'medium',
            layoutVariant = 'default',
            children,
            disable,
            onClick,
            onAsyncClick,
            loadingText,
            ...props
        },
        ref
    ) => {
        // Internal state for async operations
        const [isSubmitting, setIsSubmitting] = useState(false);

        const getButtonClasses = () => {
            // Create an array of classes
            const classes: string[] = [
                myButtonVariants.base,
                myButtonVariants.types[buttonType],
                myButtonVariants.scales[layoutVariant][scale],
            ];

            // Add text-specific styles only for text type buttons
            if (buttonType === 'text') {
                classes.push(myButtonVariants.textStyles[scale]);
            }

            return classes.join(' ');
        };

        // Handle click - supports both sync and async handlers
        const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
            // If onAsyncClick is provided, use it with double-submit prevention
            if (onAsyncClick) {
                // Prevent double-clicking if already submitting
                if (isSubmitting) return;

                // Immediately disable the button
                setIsSubmitting(true);

                try {
                    await onAsyncClick(event);
                } catch (error) {
                    console.error('MyButton: Error during async operation:', error);
                } finally {
                    // Re-enable the button when done
                    setIsSubmitting(false);
                }
            } else if (onClick) {
                // Use regular sync click handler
                onClick(event);
            }
        };

        // Render content with loading state if async
        const renderContent = () => {
            if (onAsyncClick && isSubmitting) {
                return (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {loadingText || children}
                    </span>
                );
            }
            return children;
        };

        // Determine if button should be disabled
        const isDisabled = disable ?? (props as any)?.disabled ?? (onAsyncClick && isSubmitting);

        return (
            <Button
                ref={ref}
                className={cn(getButtonClasses(), className)}
                disabled={isDisabled}
                onClick={handleClick}
                {...props}
            >
                {renderContent()}
            </Button>
        );
    }
);

MyButton.displayName = 'MyButton';

// Usage Examples:
/*
// Primary button (sync click)
<MyButton
    buttonType="primary"
    scale="large"
    layoutVariant="default"
    onClick={() => console.log('clicked')}
>
    Click Me
</MyButton>

// Async button with double-submit prevention
<MyButton
    buttonType="primary"
    scale="large"
    layoutVariant="default"
    onAsyncClick={async () => {
        await api.enrollStudent(formData);
    }}
    loadingText="Enrolling..."
>
    Enroll Student
</MyButton>

// Text variant
<MyButton
    buttonType="text"
    scale="medium"
>
    Text Button
</MyButton>

// Icon button
<MyButton
    layoutVariant="icon"
    scale="small"
>
    <IconComponent />
</MyButton>
*/

