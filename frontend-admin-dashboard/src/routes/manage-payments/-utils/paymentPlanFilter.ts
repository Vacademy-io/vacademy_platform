import type { SelectOption } from '@/components/design-system/SelectChips';
import type { PaymentLogEntry } from '@/types/payment-logs';

/**
 * The Payment Plan filter is client-side. The listing API has no plan predicate, and this screen
 * already loads the whole server-filtered result set and narrows it locally (see the KPI status
 * bucket in TransactionsView), so the plan filter narrows the same set the same way.
 *
 * Plans are matched by name rather than id: the same "Monthly" plan exists once per enroll
 * invite, and an admin filtering to "Monthly" means all of them, not one invite's copy.
 */

/** The filter key for a row's plan — its trimmed name — or null for rows with no plan (invoices). */
export const paymentPlanKey = (entry: PaymentLogEntry): string | null => {
    const name = entry?.user_plan?.payment_plan_dto?.name?.trim();
    return name ? name : null;
};

/** Distinct plan names across the loaded rows, alphabetical, ready for SelectChips. */
export const derivePaymentPlanOptions = (entries: PaymentLogEntry[]): SelectOption[] => {
    const names = new Set<string>();
    entries.forEach((entry) => {
        const key = paymentPlanKey(entry);
        if (key) names.add(key);
    });
    return [...names]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .map((name) => ({ value: name, label: name }));
};

/** Rows whose plan is one of `selected`; every row when nothing is selected. */
export const filterEntriesByPaymentPlan = (
    entries: PaymentLogEntry[],
    selected: SelectOption[]
): PaymentLogEntry[] => {
    if (selected.length === 0) return entries;
    const wanted = new Set(selected.map((s) => s.value));
    return entries.filter((entry) => {
        const key = paymentPlanKey(entry);
        return key !== null && wanted.has(key);
    });
};
