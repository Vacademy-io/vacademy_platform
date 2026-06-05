import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { UnsavedChangesBar } from '@/components/common/unsaved-changes-bar';

interface SettingsPageShellProps {
    /** Page title — rendered as the single `h1` for the settings tab. */
    title: string;
    /** Optional one-line description under the title. */
    description?: string;
    /** Right-aligned header actions (selectors, buttons, etc.). */
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Constrain content width. Defaults to `max-w-5xl`. Pass `false` for full width. */
    maxWidth?: string | false;

    /**
     * Save-bar wiring. When `onSave` is provided, a sticky `UnsavedChangesBar`
     * is rendered and appears whenever `dirty` is true. Omit these when the
     * page manages its own save bar (e.g. a parent that hosts several panels).
     */
    dirty?: boolean;
    saving?: boolean;
    onSave?: () => void;
    onDiscard?: () => void;
    saveLabel?: string;
}

/**
 * Canonical shell for a settings page: a consistent header (title + optional
 * description + actions) over a width-constrained content column, with the
 * shared `UnsavedChangesBar` wired in. Drop this around any settings tab so
 * they all share the same structure and save affordance.
 */
export function SettingsPageShell({
    title,
    description,
    actions,
    children,
    className,
    maxWidth = 'max-w-5xl',
    dirty,
    saving,
    onSave,
    onDiscard,
    saveLabel,
}: SettingsPageShellProps) {
    return (
        <div
            className={cn(
                'w-full px-4 pb-24 pt-2 sm:px-6',
                maxWidth ? `mx-auto ${maxWidth}` : '',
                className
            )}
        >
            <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-h3-semibold text-neutral-700">{title}</h1>
                    {description && (
                        <p className="text-body text-neutral-500">{description}</p>
                    )}
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </header>

            {children}

            {onSave && (
                <UnsavedChangesBar
                    dirty={!!dirty}
                    saving={!!saving}
                    onSave={onSave}
                    onDiscard={onDiscard}
                    saveLabel={saveLabel}
                />
            )}
        </div>
    );
}
