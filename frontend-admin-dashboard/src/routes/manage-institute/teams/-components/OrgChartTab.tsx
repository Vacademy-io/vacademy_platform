import { OrgChartCanvas } from './OrgChartCanvas';

interface Props {
    instituteId: string;
}

/**
 * Org Chart tab — wraps the user-to-user drag-and-drop canvas.
 *
 * The earlier team-based design (sub-teams, role labels, Cards/Tree toggle)
 * is gone. One single view, one operation pattern: pick a person, drop
 * them onto their manager. Roles render from the user's auth record at
 * draw-time so a role change on the user automatically reflects here —
 * no stale labels stored on the chart.
 */
export function OrgChartTab({ instituteId }: Props) {
    return (
        <div className="flex h-[calc(100vh-260px)] flex-col overflow-hidden rounded-md border border-neutral-200 bg-white">
            <OrgChartCanvas instituteId={instituteId} />
        </div>
    );
}
