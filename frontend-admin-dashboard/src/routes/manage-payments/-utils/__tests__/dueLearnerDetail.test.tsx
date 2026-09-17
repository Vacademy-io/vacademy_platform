import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LearnerPlanBreakdown, OutstandingLearner } from '@/services/payment-logs';

/**
 * The Due side view exists to answer one question an admin could not answer before: "I cancelled
 * this learner's plan — why do they still show a balance?" So the thing worth testing is that a
 * cancelled enrolment is VISIBLE and shown as contributing nothing, rather than silently dropped.
 */
const mockFetch = vi.fn();
vi.mock('@/services/payment-logs', () => ({
    fetchLearnerPlanBreakdown: (...args: unknown[]) => mockFetch(...args),
}));
vi.mock('@/components/common/layout-container/sidebar/utils', () => ({
    getTerminology: () => 'Course',
}));
vi.mock('@/routes/settings/-components/NamingSettings', () => ({
    ContentTerms: { Course: 'Course' },
    SystemTerms: { Course: 'Course' },
}));

import { DueLearnerDetailSheet } from '../../-components/DueLearnerDetailSheet';

const learner: OutstandingLearner = {
    user_id: 'u1',
    full_name: 'Rachna',
    email: 'raachsri@gmail.com',
    mobile_number: null,
    course_name: 'Suchbliss Health & Wellness Membership',
    payment_type: 'Enroll Invite',
    plan_status: 'ACTIVE',
    billed: 8400,
    paid: 3,
    due: 8397,
    plan_count: 2,
    pending_installments: 0,
    next_due_date: null,
    currency: 'INR',
};

const plans: LearnerPlanBreakdown[] = [
    {
        user_plan_id: 'p1',
        course_name: 'Suchbliss Health & Wellness Membership',
        plan_status: 'ACTIVE',
        payment_type: 'Enroll Invite',
        billed: 7200,
        paid: 1,
        due: 7199,
        counts_towards_due: true,
        currency: 'INR',
    },
    {
        user_plan_id: 'p2',
        course_name: 'Suchbliss Health & Wellness Membership — Monthly',
        plan_status: 'ACTIVE',
        payment_type: 'Enroll Invite',
        billed: 1200,
        paid: 1,
        due: 1199,
        counts_towards_due: true,
        currency: 'INR',
    },
    {
        user_plan_id: 'p3',
        course_name: 'Suchbliss Health & Wellness Membership — Monthly',
        plan_status: 'CANCELED',
        payment_type: 'Enroll Invite',
        billed: 1200,
        paid: 1,
        due: 0,
        counts_towards_due: false,
        currency: 'INR',
    },
];

const renderSheet = (filters?: Record<string, unknown>) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DueLearnerDetailSheet
                learner={learner}
                open
                onOpenChange={() => {}}
                filters={filters as never}
            />
        </QueryClientProvider>
    );
};

describe('DueLearnerDetailSheet', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(plans);
    });

    it('splits the enrolments into counted and not-counted', async () => {
        renderSheet();
        await waitFor(() => {
            expect(screen.getByText(/Counted towards this balance \(2\)/)).toBeInTheDocument();
        });
        expect(screen.getByText(/Not counted \(1\)/)).toBeInTheDocument();
    });

    it('shows the cancelled enrolment rather than hiding it', async () => {
        renderSheet();
        await waitFor(() => expect(screen.getByText('Cancelled')).toBeInTheDocument());
    });

    it('asks the server for this learner under the row\'s own window and course scope', async () => {
        // Not a detail: unscoped, the sheet would list enrolments the clicked row never counted
        // and the sections would stop adding up to the totals above them.
        const filters = { start_date_in_utc: '2026-08-01T00:00:00', package_session_ids: ['ps1'] };
        renderSheet(filters);
        await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('u1', filters));
    });

    it('still shows the totals when the breakdown request fails', async () => {
        mockFetch.mockRejectedValue(new Error('boom'));
        renderSheet();
        await waitFor(() =>
            expect(screen.getByText(/could not load/i)).toBeInTheDocument()
        );
        // The header figures come from the row, not the request, so they must survive.
        expect(screen.getByText('Billed')).toBeInTheDocument();
    });
});
