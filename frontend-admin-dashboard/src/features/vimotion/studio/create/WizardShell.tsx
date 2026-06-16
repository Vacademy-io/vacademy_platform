/**
 * Stepper + back/forward chrome shared by every wizard step.
 *
 * `currentStep` controls highlight + lock state. Future steps display as
 * grey-disabled. The "Back" button is hidden on Ingest; otherwise it returns
 * to the prior step in the state machine.
 */
import { CheckCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const WIZARD_STEPS = [
    { id: 'ingest', label: 'Assets', subtitle: 'Pick + tag inputs' },
    { id: 'arrangement', label: 'Arrangement', subtitle: 'Order + slice clips' },
    { id: 'cuts', label: 'Cuts', subtitle: 'Trim silences + fillers' },
    { id: 'overlays', label: 'Overlays', subtitle: 'Titles, captions, graphics' },
    { id: 'audio', label: 'Audio', subtitle: 'Music + sound effects' },
    { id: 'build', label: 'Build', subtitle: 'Assemble + open editor' },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

interface WizardShellProps {
    currentStep: WizardStepId;
    onBack?: () => void;
    children: React.ReactNode;
}

export function WizardShell({ currentStep, onBack, children }: WizardShellProps) {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Top stepper */}
            <div className="border-b border-neutral-200 bg-white">
                <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-start justify-between gap-2 overflow-x-auto">
                        {WIZARD_STEPS.map((step, i) => {
                            const isDone = i < currentIndex;
                            const isCurrent = i === currentIndex;
                            return (
                                <div
                                    key={step.id}
                                    className={cn(
                                        'flex min-w-28 flex-1 items-start gap-2',
                                        i < WIZARD_STEPS.length - 1 && 'pr-2'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                            isDone &&
                                                'bg-emerald-100 text-emerald-700',
                                            isCurrent &&
                                                'bg-neutral-900 text-white',
                                            !isDone &&
                                                !isCurrent &&
                                                'bg-neutral-100 text-neutral-500'
                                        )}
                                    >
                                        {isDone ? (
                                            <CheckCircle
                                                weight="fill"
                                                className="size-4"
                                            />
                                        ) : (
                                            i + 1
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div
                                            className={cn(
                                                'text-xs font-semibold',
                                                isCurrent
                                                    ? 'text-neutral-900'
                                                    : 'text-neutral-700'
                                            )}
                                        >
                                            {step.label}
                                        </div>
                                        <div className="text-caption text-neutral-500">
                                            {step.subtitle}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                        >
                            ← Back
                        </button>
                    )}
                    {children}
                </div>
            </div>
        </div>
    );
}
