import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// URL state for the Follow-ups screen.
//   view       — which sub-view is active (list = default, calendar = month grid).
//   date       — selected day in the calendar grid (yyyy-MM-dd local).
//   month      — month being viewed in the calendar grid (yyyy-MM local).
//   counsellor — admin-only filter; userId or omitted = all counsellors.
//   bucket     — which stat tile is active (overdue | today | upcoming | all);
//                omitted = today. Lets a sidebar sub-tab or a report drill-through
//                deep-link straight into "Overdue" instead of always landing on Today.
const FollowUpsSearchSchema = z.object({
    view: z.enum(['list', 'calendar']).optional(),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(),
    counsellor: z.string().optional(),
    bucket: z.enum(['overdue', 'today', 'upcoming', 'all']).optional().catch(undefined),
});

export type FollowUpsSearch = z.infer<typeof FollowUpsSearchSchema>;

export const Route = createFileRoute('/audience-manager/follow-ups/')({
    component: () => null,
    validateSearch: FollowUpsSearchSchema,
});
