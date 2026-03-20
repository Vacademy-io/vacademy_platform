/**
 * Compact Mode Toggle Component
 * 
 * A reusable component that allows users to toggle between default and compact UI modes.
 * Can be placed in the navbar, settings panel, or as a floating button.
 */

import { useState } from 'react';
import {
    Maximize2,
    Minimize2,
    Settings2,
    Monitor,
    Layout
} from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCompactMode } from '@/hooks/use-compact-mode';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// MAIN TOGGLE COMPONENT
// ============================================================================

interface CompactModeToggleProps {
    /**
     * Display variant
     * - 'icon': Just an icon button
     * - 'text': Text with icon
     * - 'badge': Shows mode as a badge
     */
    variant?: 'icon' | 'text' | 'badge';

    /**
     * Size of the toggle
     */
    size?: 'sm' | 'md' | 'lg';

    /**
     * Position for floating variant
     */
    position?: 'navbar' | 'floating';

    /**
     * Custom className
     */
    className?: string;

    /**
     * Show detailed popover with settings
     */
    showPopover?: boolean;
}

export function CompactModeToggle({
    variant = 'icon',
    size = 'md',
    position = 'navbar',
    className,
    showPopover = true,
}: CompactModeToggleProps) {
    const {
        isCompact,
        compactSource,
        toggleCompactMode,
        setCompactPreference,
        clearCompactPreference
    } = useCompactMode();

    const [isOpen, setIsOpen] = useState(false);

    // Size classes
    const sizeClasses = {
        sm: isCompact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        md: isCompact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-base',
        lg: isCompact ? 'px-4 py-2 text-base' : 'px-6 py-3 text-lg',
    };

    // Icon component
    const Icon = isCompact ? Minimize2 : Maximize2;

    // Trigger button content
    const TriggerContent = () => {
        switch (variant) {
            case 'badge':
                return (
                    <Badge
                        variant={isCompact ? 'default' : 'secondary'}
                        className={cn(
                            'cursor-pointer transition-colors hover:opacity-80',
                            className
                        )}
                    >
                        <Layout className={cn(
                            isCompact ? 'size-3 mr-1' : 'size-4 mr-1.5'
                        )} />
                        {isCompact ? 'Compact' : 'Default'}
                    </Badge>
                );

            case 'text':
                return (
                    <button
                        className={cn(
                            'flex items-center gap-2 rounded-lg transition-colors',
                            'hover:bg-neutral-100',
                            sizeClasses[size],
                            className
                        )}
                    >
                        <Icon className={cn(
                            isCompact ? 'size-4' : 'size-5'
                        )} />
                        <span className="hidden md:inline">
                            {isCompact ? 'Compact' : 'Default'}
                        </span>
                    </button>
                );

            case 'icon':
            default:
                return (
                    <button
                        className={cn(
                            'flex items-center justify-center rounded-lg transition-colors',
                            'hover:bg-neutral-100',
                            isCompact ? 'p-1.5' : 'p-2',
                            className
                        )}
                        aria-label={`Switch to ${isCompact ? 'default' : 'compact'} mode`}
                    >
                        <Icon className={cn(
                            isCompact ? 'size-4' : 'size-5',
                            'text-neutral-700'
                        )} />
                    </button>
                );
        }
    };

    // Simple toggle without popover
    if (!showPopover) {
        return (
            <div onClick={toggleCompactMode}>
                <TriggerContent />
            </div>
        );
    }

    // Full toggle with settings popover
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div>
                    <TriggerContent />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    'w-80',
                    isCompact && 'w-72'
                )}
                align="end"
            >
                <div className={cn(
                    'space-y-4',
                    isCompact && 'space-y-3'
                )}>
                    {/* Header */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <h4 className={cn(
                                'font-semibold text-neutral-900',
                                isCompact ? 'text-sm' : 'text-base'
                            )}>
                                Display Mode
                            </h4>
                            <Badge
                                variant={isCompact ? 'default' : 'secondary'}
                                className={cn(
                                    isCompact ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
                                )}
                            >
                                {isCompact ? 'Compact' : 'Default'}
                            </Badge>
                        </div>
                        <p className={cn(
                            'text-neutral-600',
                            isCompact ? 'text-xs' : 'text-sm'
                        )}>
                            {isCompact
                                ? 'Maximize information density for power users'
                                : 'Comfortable spacing for easy reading'
                            }
                        </p>
                    </div>

                    <Separator />

                    {/* Quick Toggle */}
                    <div className={cn(
                        'flex items-center justify-between',
                        isCompact ? 'p-2' : 'p-3',
                        'bg-neutral-50 rounded-md'
                    )}>
                        <div className="flex items-center gap-2">
                            <Monitor className={cn(
                                isCompact ? 'size-4' : 'size-5',
                                'text-neutral-600'
                            )} />
                            <span className={cn(
                                'font-medium text-neutral-900',
                                isCompact ? 'text-xs' : 'text-sm'
                            )}>
                                Compact Mode
                            </span>
                        </div>
                        <Switch
                            checked={isCompact}
                            onCheckedChange={toggleCompactMode}
                            className={cn(
                                isCompact && 'scale-90'
                            )}
                        />
                    </div>

                    {/* Active Source Info */}
                    {compactSource && (
                        <div className={cn(
                            'rounded-md border border-neutral-200 px-3 py-2',
                            isCompact && 'px-2 py-1.5'
                        )}>
                            <div className="flex items-start gap-2">
                                <Settings2 className={cn(
                                    'text-neutral-500 mt-0.5',
                                    isCompact ? 'size-3' : 'size-4'
                                )} />
                                <div>
                                    <p className={cn(
                                        'font-medium text-neutral-900',
                                        isCompact ? 'text-xs' : 'text-sm'
                                    )}>
                                        Active via: {compactSource}
                                    </p>
                                    <p className={cn(
                                        'text-neutral-600',
                                        isCompact ? 'text-[11px]' : 'text-xs'
                                    )}>
                                        {compactSource === 'route' && 'Using /cm/ route prefix'}
                                        {compactSource === 'query' && 'Using ?compact=true parameter'}
                                        {compactSource === 'preference' && 'Saved as your preference'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Save Preference */}
                    <div className="space-y-2">
                        <p className={cn(
                            'font-medium text-neutral-900',
                            isCompact ? 'text-xs' : 'text-sm'
                        )}>
                            Save as Default
                        </p>
                        <div className={cn(
                            'grid gap-2',
                            isCompact ? 'gap-1.5' : 'gap-2'
                        )}>
                            <Button
                                variant={compactSource === 'preference' && isCompact ? 'default' : 'outline'}
                                size={isCompact ? 'sm' : 'default'}
                                onClick={() => {
                                    setCompactPreference(true);
                                    setIsOpen(false);
                                }}
                                className="w-full justify-start"
                            >
                                <Minimize2 className={cn(
                                    'mr-2',
                                    isCompact ? 'size-3' : 'size-4'
                                )} />
                                Always use Compact
                            </Button>
                            <Button
                                variant={compactSource === 'preference' && !isCompact ? 'default' : 'outline'}
                                size={isCompact ? 'sm' : 'default'}
                                onClick={() => {
                                    setCompactPreference(false);
                                    setIsOpen(false);
                                }}
                                className="w-full justify-start"
                            >
                                <Maximize2 className={cn(
                                    'mr-2',
                                    isCompact ? 'size-3' : 'size-4'
                                )} />
                                Always use Default
                            </Button>
                        </div>
                        {compactSource === 'preference' && (
                            <Button
                                variant="ghost"
                                size={isCompact ? 'sm' : 'default'}
                                onClick={() => {
                                    clearCompactPreference();
                                    setIsOpen(false);
                                }}
                                className="w-full"
                            >
                                Clear Preference
                            </Button>
                        )}
                    </div>

                </div>
            </PopoverContent>
        </Popover>
    );
}

// ============================================================================
// FLOATING TOGGLE BUTTON (Optional)
// ============================================================================

interface FloatingCompactToggleProps {
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function FloatingCompactToggle({
    position = 'bottom-right'
}: FloatingCompactToggleProps) {
    const { isCompact } = useCompactMode();

    const positionClasses = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6',
        'top-right': 'top-20 right-6',
        'top-left': 'top-20 left-6',
    };

    return (
        <div
            className={cn(
                'fixed z-50',
                positionClasses[position]
            )}
        >
            <CompactModeToggle
                variant="icon"
                size={isCompact ? 'sm' : 'md'}
                position="floating"
                showPopover
                className={cn(
                    'shadow-lg border border-neutral-200 bg-white',
                    isCompact ? 'hover:shadow-md' : 'hover:shadow-xl'
                )}
            />
        </div>
    );
}

// ============================================================================
// NAVBAR INTEGRATION EXAMPLE
// ============================================================================

/**
 * Example of how to integrate into the navbar
 * 
 * Usage in navbar.tsx:
 * 
 * ```tsx
 * import { CompactModeToggle } from '@/components/compact-mode/CompactModeToggle';
 * 
 * export function Navbar() {
 *   return (
 *     <div className="navbar">
 *       // ... other navbar items
 *       <CompactModeToggle variant="icon" />
 *     </div>
 *   );
 * }
 * ```
 */

// ============================================================================
// SETTINGS PAGE INTEGRATION
// ============================================================================

export function CompactModeSettings() {
    const {
        isCompact,
        compactSource,
        toggleCompactMode,
        setCompactPreference
    } = useCompactMode();

    return (
        <div className={cn(
            'rounded-lg border border-neutral-200 bg-white',
            isCompact ? 'p-4' : 'p-6'
        )}>
            <div className={cn(
                'space-y-4',
                isCompact && 'space-y-3'
            )}>
                <div>
                    <h3 className={cn(
                        'font-semibold text-neutral-900',
                        isCompact ? 'text-base' : 'text-lg'
                    )}>
                        Display Density
                    </h3>
                    <p className={cn(
                        'text-neutral-600 mt-1',
                        isCompact ? 'text-xs' : 'text-sm'
                    )}>
                        Choose how information is displayed across the dashboard
                    </p>
                </div>

                <Separator />

                {/* Current Mode */}
                <div className={cn(
                    'flex items-center justify-between rounded-md border border-neutral-200',
                    isCompact ? 'p-3' : 'p-4'
                )}>
                    <div>
                        <p className={cn(
                            'font-medium text-neutral-900',
                            isCompact ? 'text-sm' : 'text-base'
                        )}>
                            Current Mode
                        </p>
                        <p className={cn(
                            'text-neutral-600',
                            isCompact ? 'text-xs' : 'text-sm'
                        )}>
                            {isCompact ? 'Compact - Dense layout' : 'Default - Comfortable spacing'}
                        </p>
                    </div>
                    <Badge variant={isCompact ? 'default' : 'secondary'}>
                        {isCompact ? 'Compact' : 'Default'}
                    </Badge>
                </div>

                {/* Mode Selection */}
                <div className={cn(
                    'grid gap-3',
                    isCompact ? 'gap-2' : 'gap-3'
                )}>
                    <button
                        onClick={() => setCompactPreference(false)}
                        className={cn(
                            'flex items-start gap-3 rounded-md border-2 transition-colors text-left',
                            isCompact ? 'p-3' : 'p-4',
                            !isCompact && compactSource === 'preference'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                        )}
                    >
                        <Maximize2 className={cn(
                            'text-neutral-600 mt-1',
                            isCompact ? 'size-4' : 'size-5'
                        )} />
                        <div className="flex-1">
                            <h4 className={cn(
                                'font-medium text-neutral-900',
                                isCompact ? 'text-sm' : 'text-base'
                            )}>
                                Default Mode
                            </h4>
                            <p className={cn(
                                'text-neutral-600 mt-1',
                                isCompact ? 'text-xs' : 'text-sm'
                            )}>
                                Comfortable spacing, larger text, easier  on the eyes. Best for most users.
                            </p>
                        </div>
                    </button>

                    <button
                        onClick={() => setCompactPreference(true)}
                        className={cn(
                            'flex items-start gap-3 rounded-md border-2 transition-colors text-left',
                            isCompact ? 'p-3' : 'p-4',
                            isCompact && compactSource === 'preference'
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                        )}
                    >
                        <Minimize2 className={cn(
                            'text-neutral-600 mt-1',
                            isCompact ? 'size-4' : 'size-5'
                        )} />
                        <div className="flex-1">
                            <h4 className={cn(
                                'font-medium text-neutral-900',
                                isCompact ? 'text-sm' : 'text-base'
                            )}>
                                Compact Mode
                            </h4>
                            <p className={cn(
                                'text-neutral-600 mt-1',
                                isCompact ? 'text-xs' : 'text-sm'
                            )}>
                                Dense layout, smaller text, more content on screen. Ideal for power users managing many modules.
                            </p>
                        </div>
                    </button>
                </div>

                {/* Preview */}
                <div className={cn(
                    'rounded-md bg-neutral-50 border border-neutral-200',
                    isCompact ? 'p-3' : 'p-4'
                )}>
                    <p className={cn(
                        'font-medium text-neutral-900 mb-2',
                        isCompact ? 'text-xs' : 'text-sm'
                    )}>
                        Quick Preview
                    </p>
                    <div className={cn(
                        'grid grid-cols-2 gap-2',
                        isCompact && 'gap-1.5'
                    )}>
                        <div className={cn(
                            'rounded border bg-white',
                            isCompact ? 'p-2' : 'p-4'
                        )}>
                            <div className={cn(
                                'h-2 w-full bg-neutral-200 rounded mb-2',
                                isCompact && 'mb-1 h-1.5'
                            )} />
                            <div className={cn(
                                'h-2 w-3/4 bg-neutral-200 rounded',
                                isCompact && 'h-1.5'
                            )} />
                        </div>
                        <div className={cn(
                            'rounded border bg-white',
                            isCompact ? 'p-2' : 'p-4'
                        )}>
                            <div className={cn(
                                'h-2 w-full bg-neutral-200 rounded mb-2',
                                isCompact && 'mb-1 h-1.5'
                            )} />
                            <div className={cn(
                                'h-2 w-3/4 bg-neutral-200 rounded',
                                isCompact && 'h-1.5'
                            )} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
