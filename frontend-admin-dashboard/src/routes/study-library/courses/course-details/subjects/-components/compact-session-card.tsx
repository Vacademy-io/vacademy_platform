import { useNavigate } from '@tanstack/react-router';
import { Copy, LockSimple, Clock } from '@phosphor-icons/react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Badge } from '@/components/ui/badge';
import { MyButton } from '@/components/design-system/button';
import { copyToClipboard } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/helper';
import { getSessionJoinLink } from '@/routes/study-library/live-session/-utils/live-sesstions';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import type { SessionSearchResponseItem } from '@/routes/study-library/live-session/-services/utils';

// Strip any trailing timezone offset so we can re-anchor the wall-clock time in
// the session's declared timezone (mirrors the logic in LiveSessionCard).
const normalizeTime = (t: string) => {
    if (t.includes('T')) {
        const afterT = t.split('T')[1] || t;
        return afterT.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
    }
    return t.replace(/[+-]\d{2}:\d{2}$|Z$/, '');
};

/**
 * Slim session card for the Course Details → Live Sessions tab. Deliberately
 * carries less than the full {@link LiveSessionCard}: title, access chip, a
 * single start–end time line, and a copy-link action. No batches / QR / report
 * dialog — this is a quick at-a-glance list, not the management surface.
 */
const CompactSessionCard = ({ session }: { session: SessionSearchResponseItem }) => {
    const navigate = useNavigate();
    const { instituteDetails } = useInstituteDetailsStore();

    const tz = session.timezone || 'Asia/Kolkata';
    const start = fromZonedTime(`${session.meeting_date}T${normalizeTime(session.start_time)}`, tz);
    const end = fromZonedTime(
        `${session.meeting_date}T${normalizeTime(session.last_entry_time)}`,
        tz
    );
    const startFormatted = formatInTimeZone(start, tz, 'dd MMM, h:mm a');
    const endFormatted = formatInTimeZone(end, tz, 'h:mm a');

    const joinLink = getSessionJoinLink(session, instituteDetails?.learner_portal_base_url ?? '');

    return (
        <div
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 transition-shadow hover:shadow-sm"
            onClick={() =>
                navigate({
                    to: '/study-library/live-session/view/$sessionId',
                    params: { sessionId: session.session_id },
                })
            }
        >
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium text-neutral-700">
                        {session.title}
                    </h4>
                    <Badge className="shrink-0 gap-1 rounded-md border border-neutral-300 bg-primary-50 py-0.5 text-xs font-normal shadow-none">
                        <LockSimple size={12} />
                        {session.access_level}
                    </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                    {session.subject && <span>{session.subject}</span>}
                    <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {startFormatted} – {endFormatted}
                    </span>
                </div>
            </div>
            <MyButton
                type="button"
                scale="small"
                buttonType="secondary"
                className="h-8 min-w-8 shrink-0"
                onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(joinLink);
                }}
            >
                <Copy size={16} />
            </MyButton>
        </div>
    );
};

export default CompactSessionCard;
