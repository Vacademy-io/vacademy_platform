import { useCallback, useMemo, useState } from 'react';
import { SlidersHorizontal } from '@phosphor-icons/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MyButton } from '@/components/design-system/button';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { hasNotYetDueBalance, type KpiBilling, type KpiCardKey } from './PaymentKpiCards';

/** Every card an admin can switch on or off, in display order. */
export const KPI_CARD_OPTIONS: { key: KpiCardKey; label: string; description: string }[] = [
    { key: 'paid', label: 'Collected', description: 'Money received' },
    { key: 'outstanding', label: 'Outstanding', description: 'Everything still to collect' },
    { key: 'due', label: 'Due', description: 'Overdue right now' },
    { key: 'upcoming', label: 'Upcoming', description: 'Expected, not yet owed' },
    { key: 'pending', label: 'Payment pending', description: 'Online checkouts in progress' },
    { key: 'failed', label: 'Failed', description: 'Online payments declined' },
];

/**
 * What an institute sees before anyone touches the settings.
 *
 * With instalment plans, Upcoming already carries every future instalment, so Outstanding would
 * only repeat Due + Upcoming — it starts hidden. Otherwise the row is exactly what it was before
 * the settings existed: Outstanding appears only when it says something Due does not.
 */
export const defaultVisibleKpiCards = (billing?: KpiBilling | null): Set<KpiCardKey> => {
    const keys = KPI_CARD_OPTIONS.map((o) => o.key).filter((key) => {
        if (key !== 'outstanding') return true;
        if (billing?.usesInstallments) return false;
        return hasNotYetDueBalance(billing);
    });
    return new Set(keys);
};

const storageKey = () => `payment-kpi-cards:${getCurrentInstituteId() ?? 'default'}`;

const readStored = (): KpiCardKey[] | null => {
    try {
        const raw = localStorage.getItem(storageKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const known = new Set(KPI_CARD_OPTIONS.map((o) => o.key));
        return parsed.filter((x): x is KpiCardKey => known.has(x));
    } catch {
        return null;
    }
};

/**
 * Which KPI cards (and their matching tabs) are on, per institute in this browser. Until the admin
 * picks, the defaults follow the institute's fee model (see defaultVisibleKpiCards) and keep
 * tracking it; the first tick freezes an explicit list. Shared by Manage Payments and the Payment
 * Dashboard through the same storage key.
 */
export function useKpiCardPrefs(billing?: KpiBilling | null) {
    const [stored, setStored] = useState<KpiCardKey[] | null>(readStored);

    const visible = useMemo(
        () => (stored ? new Set(stored) : defaultVisibleKpiCards(billing)),
        [stored, billing]
    );

    const persist = (next: KpiCardKey[] | null) => {
        try {
            if (next) localStorage.setItem(storageKey(), JSON.stringify(next));
            else localStorage.removeItem(storageKey());
        } catch {
            /* storage blocked — keep the in-memory choice */
        }
        setStored(next);
    };

    const toggle = useCallback(
        (key: KpiCardKey) => {
            const next = new Set(visible);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            persist(KPI_CARD_OPTIONS.map((o) => o.key).filter((k) => next.has(k)));
        },
        [visible]
    );

    const reset = useCallback(() => persist(null), []);

    return { visible, toggle, reset, isCustomised: stored !== null };
}

interface KpiCardSettingsProps {
    visible: Set<KpiCardKey>;
    onToggle: (key: KpiCardKey) => void;
    onReset: () => void;
    isCustomised: boolean;
}

/** The "Cards" button: tick which summary cards (and their tabs) to show. */
export function KpiCardSettings({
    visible,
    onToggle,
    onReset,
    isCustomised,
}: KpiCardSettingsProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <MyButton buttonType="secondary" scale="medium" className="gap-2">
                    <SlidersHorizontal size={16} />
                    Cards
                </MyButton>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
                <div className="mb-2 flex items-center justify-between">
                    <span className="text-caption font-semibold text-neutral-700">
                        Show cards & tabs
                    </span>
                    {isCustomised && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-2xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                            Reset to default
                        </button>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    {KPI_CARD_OPTIONS.map((option) => (
                        <label
                            key={option.key}
                            className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-neutral-50"
                        >
                            <Checkbox
                                className="mt-0.5"
                                checked={visible.has(option.key)}
                                onCheckedChange={() => onToggle(option.key)}
                            />
                            <span className="flex flex-col">
                                <span className="text-caption text-neutral-700">
                                    {option.label}
                                </span>
                                <span className="text-2xs text-neutral-400">
                                    {option.description}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
