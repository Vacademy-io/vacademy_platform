import { Check, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from '../-utils/constants';
import type { WizardStepId } from '../-types';

interface WizardRailProps {
    current: WizardStepId;
    /** Steps the user has already left — only these show a completed / error state. */
    visited: Set<WizardStepId>;
    /** Blocker count per step, used for the error badge. */
    issues: Record<WizardStepId, number>;
    onSelect: (step: WizardStepId) => void;
}

export function WizardRail({ current, visited, issues, onSelect }: WizardRailProps) {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current);

    return (
        <nav aria-label="Announcement steps" className="w-full">
            <ol className="flex w-full items-start gap-1 overflow-x-auto pb-1 sm:gap-2">
                {WIZARD_STEPS.map((step, index) => {
                    const isCurrent = step.id === current;
                    const isVisited = visited.has(step.id);
                    const hasIssues = isVisited && !isCurrent && issues[step.id] > 0;
                    const isDone = isVisited && !isCurrent && issues[step.id] === 0;
                    const isReachable = isVisited || index <= currentIndex;

                    return (
                        <li key={step.id} className="flex min-w-0 flex-1 items-start">
                            <button
                                type="button"
                                onClick={() => onSelect(step.id)}
                                aria-current={isCurrent ? 'step' : undefined}
                                className={cn(
                                    'group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-md px-1 py-2 text-center transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isReachable
                                        ? 'cursor-pointer hover:bg-muted/60'
                                        : 'cursor-pointer'
                                )}
                            >
                                <span className="flex w-full items-center gap-2">
                                    <span
                                        className={cn(
                                            'hidden h-px flex-1 rounded-full transition-colors sm:block',
                                            index === 0 && 'invisible',
                                            index <= currentIndex ? 'bg-primary-300' : 'bg-border'
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            'flex size-8 shrink-0 items-center justify-center rounded-full border text-caption font-semibold transition-colors',
                                            isCurrent &&
                                                'border-primary-500 bg-primary-500 text-neutral-50 shadow-sm',
                                            hasIssues &&
                                                'border-danger-400 bg-danger-50 text-danger-600',
                                            isDone &&
                                                'border-primary-200 bg-primary-50 text-primary-600',
                                            !isCurrent &&
                                                !hasIssues &&
                                                !isDone &&
                                                'border-border bg-card text-muted-foreground'
                                        )}
                                    >
                                        {hasIssues ? (
                                            <WarningCircle weight="fill" className="size-4" />
                                        ) : isDone ? (
                                            <Check weight="bold" className="size-4" />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span
                                        className={cn(
                                            'hidden h-px flex-1 rounded-full transition-colors sm:block',
                                            index === WIZARD_STEPS.length - 1 && 'invisible',
                                            index < currentIndex ? 'bg-primary-300' : 'bg-border'
                                        )}
                                    />
                                </span>
                                <span className="min-w-0">
                                    <span
                                        className={cn(
                                            'block truncate text-caption font-semibold',
                                            isCurrent
                                                ? 'text-primary-600'
                                                : hasIssues
                                                  ? 'text-danger-600'
                                                  : 'text-foreground'
                                        )}
                                    >
                                        {step.title}
                                    </span>
                                    <span className="hidden truncate text-caption text-muted-foreground md:block">
                                        {hasIssues ? `${issues[step.id]} to fix` : step.caption}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
