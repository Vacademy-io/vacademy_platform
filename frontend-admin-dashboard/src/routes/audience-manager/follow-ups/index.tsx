import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// URL state for the Follow-ups screen.
//   view       — which sub-view is active (list = default, calendar = month grid).
//   date       — selected day in the calendar grid (yyyy-MM-dd local).
//   month      — month being viewed in the calendar grid (yyyy-MM local).
//   counsellor — admin-only filter; userId or omitted = all counsellors.
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
});

export type FollowUpsSearch = z.infer<typeof FollowUpsSearchSchema>;

export const Route = createFileRoute('/audience-manager/follow-ups/')({
    component: () => null,
    validateSearch: FollowUpsSearchSchema,
});
