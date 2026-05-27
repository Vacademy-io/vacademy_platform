import { Check } from "@phosphor-icons/react";
import { cn } from '@/lib/utils';
import { useProductPageStore } from '../-stores/product-page-store';

const CHECKOUT_STEPS = [
    { id: 'CART' as const, label: 'Cart' },
    { id: 'FORM' as const, label: 'Details' },
    { id: 'PAYMENT' as const, label: 'Payment' },
];

export const StepProgress = ({ primaryColor = '#2563eb' }: { primaryColor?: string }) => { // design-lint-ignore: page-builder default color
    const { step } = useProductPageStore();
    const currentIndex = CHECKOUT_STEPS.findIndex((s) => s.id === step);

    return (
        <nav aria-label="Enrollment progress" className="flex items-center justify-center">
            {CHECKOUT_STEPS.map((s, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                    <div key={s.id} className="flex items-center">
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                className={cn(
                                    'flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                                    !done && !active && 'bg-gray-100 text-gray-400',
                                )}
                                style={
                                    done
                                        ? { backgroundColor: '#22c55e', color: 'white' } // design-lint-ignore: page-builder default color
                                        : active
                                          ? { backgroundColor: primaryColor, color: 'white', boxShadow: `0 0 0 4px ${primaryColor}33` }
                                          : undefined
                                }
                            >
                                {done ? <Check className="size-4" /> : i + 1}
                            </div>
                            <span
                                className={cn(
                                    'text-xs font-medium',
                                    !done && !active && 'text-gray-400',
                                )}
                                style={
                                    active ? { color: primaryColor }
                                    : done ? { color: '#22c55e' } // design-lint-ignore: page-builder default color
                                    : undefined
                                }
                            >
                                {s.label}
                            </span>
                        </div>
                        {i < CHECKOUT_STEPS.length - 1 && (
                            <div
                                className="mb-5 h-px w-14 sm:w-20"
                                style={{ backgroundColor: i < currentIndex ? '#86efac' : '#e5e7eb' }} // design-lint-ignore: page-builder default color
                            />
                        )}
                    </div>
                );
            })}
        </nav>
    );
};
