import React, { useEffect, useState } from 'react';
import { Check, PencilSimpleLine, X } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { MyButton } from '@/components/design-system/button';
import { cn } from '@/lib/utils';

/**
 * Renders a name as text with a pencil affordance that swaps it for an input.
 * Commits on Enter or blur, discards on Escape or Cancel. Renaming an existing
 * session/level is carried to the backend by the normal update-course payload,
 * which renames the shared institute-level row.
 */
export const InlineNameEditor: React.FC<{
    value: string;
    onSave: (name: string) => void;
    editLabel: string;
    /** Returns an error message to block the rename, or null to accept it. */
    validate?: (name: string) => string | null;
    /** Shown while editing — e.g. that this row is shared with other courses. */
    warning?: string | null;
    textClassName?: string;
    inputClassName?: string;
}> = ({ value, onSave, editLabel, validate, warning, textClassName, inputClassName }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isEditing) {
            setDraft(value);
            setError(null);
        }
    }, [value, isEditing]);

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed === value) {
            setError(null);
            setIsEditing(false);
            return;
        }
        // A rejected name keeps the editor open so the reason stays visible,
        // rather than silently reverting.
        const validationError = validate ? validate(trimmed) : trimmed ? null : 'Name is required';
        if (validationError) {
            setError(validationError);
            return;
        }
        onSave(trimmed);
        setError(null);
        setIsEditing(false);
    };

    const cancel = () => {
        setDraft(value);
        setError(null);
        setIsEditing(false);
    };

    if (!isEditing) {
        return (
            <div className="flex items-center gap-1">
                <span className={textClassName}>{value}</span>
                <MyButton
                    type="button"
                    buttonType="text"
                    scale="medium"
                    layoutVariant="icon"
                    onClick={() => setIsEditing(true)}
                    aria-label={editLabel}
                    className="text-gray-500 hover:text-gray-700"
                >
                    <PencilSimpleLine className="size-3" />
                </MyButton>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                <Input
                    autoFocus
                    value={draft}
                    aria-label={editLabel}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setError(null);
                    }}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancel();
                        }
                    }}
                    className={cn(
                        'h-7 border-gray-300 text-sm',
                        error && 'border-danger-500',
                        inputClassName
                    )}
                />
                <MyButton
                    type="button"
                    buttonType="text"
                    scale="medium"
                    layoutVariant="icon"
                    // Let the click land instead of the blur-commit unmounting this button first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commit}
                    aria-label="Save name"
                    className="text-primary-500 hover:text-primary-600"
                >
                    <Check className="size-3" />
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="text"
                    scale="medium"
                    layoutVariant="icon"
                    // Keep the blur-commit from firing before the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={cancel}
                    aria-label="Cancel rename"
                    className="text-gray-500 hover:text-gray-700"
                >
                    <X className="size-3" />
                </MyButton>
            </div>
            {error ? (
                <p className="text-xs text-danger-600">{error}</p>
            ) : (
                warning && <p className="max-w-md text-xs text-warning-600">{warning}</p>
            )}
        </div>
    );
};
