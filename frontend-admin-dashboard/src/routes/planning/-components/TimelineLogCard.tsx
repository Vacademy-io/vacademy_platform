import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2, Share2 } from 'lucide-react';
import type { PlanningLog } from '../-types/types';
import { formatIntervalType, formatIntervalTypeId } from '../-utils/intervalTypeIdFormatter';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

interface TimelineLogCardProps {
    log: PlanningLog;
    logType: 'planning' | 'diary_log';
    searchQuery: string;
    onView: (log: PlanningLog) => void;
    onDelete: (log: PlanningLog) => void;
    highlightText: (text: string, highlight: string) => React.ReactNode;
}

export default function TimelineLogCard({
    log,
    logType,
    searchQuery,
    onView,
    onDelete,
    highlightText,
}: TimelineLogCardProps) {
    // Get package session details using the hook
    const getDetailsFromPackageSessionId = useInstituteDetailsStore(
        (state) => state.getDetailsFromPackageSessionId
    );

    const batchDetails = getDetailsFromPackageSessionId({
        packageSessionId: log.entity_id,
    });

    const packageSessionName = batchDetails
        ? batchDetails.name
            ? `${batchDetails.package_dto.package_name} ${batchDetails.name}`
            : `${batchDetails.package_dto.package_name} - ${batchDetails.level.level_name} - ${batchDetails.session.session_name}`
        : '';

    return (
        <div className="rounded-lg border p-4">
            <div className="space-y-3">
                {/* Primary: Interval Type and Period */}
                <div className="flex items-center gap-3">
                    {logType === 'planning' && (
                        <>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="px-3 py-1 text-base font-semibold"
                                >
                                    {formatIntervalType(log.interval_type)}
                                </Badge>
                                <span className="text-lg font-bold">
                                    {formatIntervalTypeId(log.interval_type_id)}
                                </span>
                            </div>
                        </>
                    )}
                    {log.is_shared_with_student && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <Share2 className="size-3" />
                            Shared with {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                        </Badge>
                    )}
                </div>

                {/* Package Session Name */}
                {packageSessionName && (
                    <div className="text-sm font-medium text-foreground">
                        {highlightText(packageSessionName, searchQuery)}
                    </div>
                )}

                {/* Secondary: Title */}
                <div className="text-sm text-muted-foreground">
                    {highlightText(log.title, searchQuery)}
                </div>

                {/* Meta information */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Created by: {log.created_by}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => onView(log)}>
                        <Eye className="mr-2 size-4" />
                        View
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(log)}
                        className="text-destructive hover:text-destructive"
                    >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
