import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

// URL state for the Follow-ups screen.
//   view       — which sub-view is active (list = default, calendar = month grid).
//   date       — selected day in the calendar grid (yyyy-MM-dd local).
//   month      — month being viewed in the calendar grid (yyyy-MM local).
//   counsellor — admin-only filter; comma-separated userIds, omitted = all counsellors.
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
    bucket: z.enum(['overdue', 'today', 'upcoming', 'all', 'completed']).optional(),
    /** Comma-separated filter names this ROUTE owns (see recent-leads/-components/
     *  pinned-filters.ts). `lock=bucket` keeps a sub-tab on its own bucket instead of
     *  letting a stray card click turn "Overdue Follow ups" into Pending. */
    lock: z.string().optional(),
});

export type FollowUpsSearch = z.infer<typeof FollowUpsSearchSchema>;

export const Route = createFileRoute('/audience-manager/follow-ups/')({
    component: () => null,
    validateSearch: FollowUpsSearchSchema,
});
