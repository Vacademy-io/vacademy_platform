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
    /** Which stat tile the page opens on. Sidebar sub-tabs link straight to one
     *  ("Overdue Follow ups" -> ?bucket=overdue); before this the param was dropped
     *  by the schema and every such tab landed on "today". */
    bucket: z.enum(['overdue', 'today', 'upcoming', 'all']).optional(),
});

export type FollowUpsSearch = z.infer<typeof FollowUpsSearchSchema>;

export const Route = createFileRoute('/audience-manager/follow-ups/')({
    component: () => null,
    validateSearch: FollowUpsSearchSchema,
});
