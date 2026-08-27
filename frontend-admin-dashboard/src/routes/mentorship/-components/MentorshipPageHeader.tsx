/**
 * The title block every mentorship screen opens with.
 *
 * Navigation lives in the sidebar group (Overview / Mentors / Sessions / Requests /
 * My Mentorship), so each screen only has to say what it is and offer its own
 * actions — no second navigation strip repeating what the sidebar already shows.
 */
export function MentorshipPageHeader({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
                <h2 className="text-title font-semibold text-neutral-700">{title}</h2>
                <p className="text-body text-neutral-500">{subtitle}</p>
            </div>
            {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
    );
}
