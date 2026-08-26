import { CheckCircle, Tag } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { OfferStatus } from '../-utils/offers';

/**
 * The page's predefined offers, as scannable cards rather than a footnote.
 *
 * Shown whether or not they have been earned, and each one names the exact gap
 * that would earn it. An offer the visitor never knew they nearly had grows no
 * basket, and "spend more to save more" is not an instruction anyone can act on.
 */

interface OffersStripProps {
    offers: OfferStatus[];
    money: (n: number) => string;
}

export const OffersStrip = ({ offers, money }: OffersStripProps) => {
    if (offers.length === 0) return null;

    return (
        <section aria-label="Available offers">
            <h2 className="mb-2 text-sm font-bold text-gray-900">Offers for you</h2>
            {/* Scrolls inside itself so a long offer list never widens the page. */}
            <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
                {offers.map((o) => {
                    const gap =
                        o.amountShort > 0
                            ? `Add ${money(o.amountShort)} more to unlock`
                            : o.coursesShort > 0
                              ? `Add ${o.coursesShort} more subject${o.coursesShort === 1 ? '' : 's'} to unlock`
                              : null;
                    return (
                        <li
                            key={o.rule.id}
                            className={cn(
                                'flex w-60 shrink-0 items-start gap-2.5 rounded-xl border px-3.5 py-3 transition-colors',
                                o.applied
                                    ? 'border-success-300 bg-success-50'
                                    : o.unlocked
                                      ? 'border-gray-200 bg-white'
                                      : 'border-dashed border-gray-300 bg-gray-50'
                            )}
                        >
                            {o.applied ? (
                                <CheckCircle
                                    className="mt-0.5 size-4 shrink-0 text-success-600"
                                    weight="fill"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Tag
                                    className={cn(
                                        'mt-0.5 size-4 shrink-0',
                                        o.unlocked ? 'text-primary-500' : 'text-gray-400'
                                    )}
                                    aria-hidden="true"
                                />
                            )}
                            <div className="min-w-0">
                                <p
                                    className={cn(
                                        'text-caption font-bold',
                                        o.applied ? 'text-success-700' : 'text-gray-900'
                                    )}
                                >
                                    {o.rule.label}
                                </p>
                                {/* Colour alone never carries the state — the word does too. */}
                                <p
                                    className={cn(
                                        'mt-0.5 text-caption',
                                        o.applied ? 'text-success-600' : 'text-gray-500'
                                    )}
                                >
                                    {o.applied ? 'Applied to your order' : (gap ?? 'Ready to apply')}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};
