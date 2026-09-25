import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';

vi.mock('@/lib/auth/instituteUtils', () => ({ getCurrentInstituteId: () => 'inst-1' }));

// The test environment ships without Web Storage; a plain map is all the hook needs.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
});

import { emptyPaymentSummary } from '../paymentSummary';
import { PaymentKpiCards, type KpiBilling } from '../../-components/PaymentKpiCards';
import { defaultVisibleKpiCards, useKpiCardPrefs } from '../../-components/KpiCardSettings';

/**
 * Vasco runs instalment plans whose next instalment is weeks away, so the 30-day Upcoming read ₹0
 * next to an Outstanding of lakhs — three cards, all describing the same money differently. An
 * instalment institute now sees every future instalment under Upcoming and no separate
 * Outstanding; everyone else keeps the row they had. Admins can pick the cards themselves.
 */

const billing = (over: Partial<KpiBilling> = {}): KpiBilling => ({
    collected: 450000,
    due: 0,
    upcoming: 0,
    upcomingDays: 30,
    learnersOwing: 0,
    learnersUpcoming: 0,
    activatedWithoutPaymentCount: 0,
    outstanding: 845000,
    learnersOutstanding: 23,
    upcomingAll: 845000,
    learnersUpcomingAll: 23,
    nextDueDate: '2026-11-06',
    usesInstallments: true,
    currency: 'INR',
    ...over,
});

describe('default cards', () => {
    it('instalment institute: Upcoming replaces Outstanding', () => {
        const keys = defaultVisibleKpiCards(billing());
        expect(keys.has('outstanding')).toBe(false);
        expect([...keys]).toEqual(['paid', 'due', 'upcoming', 'pending', 'failed']);
    });

    it('subscription institute (Suchbliss): exactly the old row', () => {
        const suchbliss = billing({
            usesInstallments: false,
            due: 7299,
            outstanding: 7299,
            upcoming: 23400,
            upcomingAll: 23400,
        });
        expect([...defaultVisibleKpiCards(suchbliss)]).toEqual([
            'paid',
            'due',
            'upcoming',
            'pending',
            'failed',
        ]);
    });

    it('non-instalment institute with future invoices still gets Outstanding', () => {
        const keys = defaultVisibleKpiCards(
            billing({ usesInstallments: false, due: 100, outstanding: 500 })
        );
        expect(keys.has('outstanding')).toBe(true);
    });
});

describe('Upcoming card for instalments', () => {
    it('shows every future instalment and the next due date, not the 30-day ₹0', () => {
        render(
            <PaymentKpiCards
                summary={emptyPaymentSummary()}
                billing={billing()}
                visibleKeys={defaultVisibleKpiCards(billing())}
            />
        );
        expect(screen.queryByText('Outstanding')).toBeNull();
        expect(screen.getByText('Upcoming')).toBeTruthy();
        expect(screen.getByText(/845,000/)).toBeTruthy();
        expect(screen.getByText(/23 learners · next due 6 Nov/)).toBeTruthy();
    });

    it('keeps the 30-day figure when the institute has no instalments', () => {
        render(
            <PaymentKpiCards
                summary={emptyPaymentSummary()}
                billing={billing({
                    usesInstallments: false,
                    upcoming: 23400,
                    learnersUpcoming: 13,
                })}
            />
        );
        expect(screen.getByText(/13 learners · next 30 days/)).toBeTruthy();
    });
});

describe('card preferences', () => {
    beforeEach(() => localStorage.clear());

    it('a ticked choice sticks per institute; reset returns to the defaults', () => {
        const { result } = renderHook(() => useKpiCardPrefs(billing()));
        expect(result.current.isCustomised).toBe(false);

        act(() => result.current.toggle('failed'));
        expect(result.current.visible.has('failed')).toBe(false);
        expect(JSON.parse(localStorage.getItem('payment-kpi-cards:inst-1') ?? '[]')).not.toContain(
            'failed'
        );

        const again = renderHook(() => useKpiCardPrefs(billing()));
        expect(again.result.current.visible.has('failed')).toBe(false);

        act(() => result.current.reset());
        expect(result.current.visible.has('failed')).toBe(true);
        expect(localStorage.getItem('payment-kpi-cards:inst-1')).toBeNull();
    });
});
