import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingToggleRowProps {
    /** Primary label for the setting. */
    label: ReactNode;
    /** Optional helper text shown under the label. */
    description?: ReactNode;
    /** The control on the right — a `Switch`, `Select`, `MyButton`, etc. */
    control: ReactNode;
    className?: string;
}

/**
 * Canonical row for a single labelled setting: title (+ optional description)
 * on the left, a control on the right. Use this instead of hand-rolling the
 * `flex items-center justify-between rounded border p-3` pattern so every
 * settings page reads the same.
 */
export function SettingToggleRow({
    label,
    description,
    control,
    className,
}: SettingToggleRowProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-between gap-4 rounded-md border border-border p-3',
                className
            )}
        >
            <div className="min-w-0 space-y-0.5">
                <div className="text-sm text-neutral-700">{label}</div>
                {description && (
                    <p className="text-caption text-neutral-500">{description}</p>
                )}
            </div>
            <div className="shrink-0">{control}</div>
        </div>
    );
}
