import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { MyButton } from '@/components/design-system/button';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { cn } from '@/lib/utils';
import { ButtonScale } from '@/components/design-system/utils/types/button-types';
import { getTerminology } from '../layout-container/sidebar/utils';
import { RoleTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { BulkAssignDialog } from '@/routes/manage-students/students-list/-components/enroll-bulk/bulk-assign-dialog/BulkAssignDialog';
import { GraduationCap } from 'lucide-react';

export const EnrollStudentsButton = ({
    scale = 'medium',
    className,
    initialPackageSessionId,
}: {
    scale?: ButtonScale;
    className?: string;
    initialPackageSessionId?: string;
}) => {
    const { getCourseFromPackage } = useInstituteDetailsStore();
    const [open, setOpen] = useState(false);

    const isDisabled = getCourseFromPackage().length === 0;

    // Auto-open the enroll dialog when this page is visited with ?action=enroll
    // (e.g. from the dashboard "Add Student" quick action). The param is
    // cleared once consumed so a refresh doesn't reopen the dialog.
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        const search = location.search as Record<string, unknown> | undefined;
        if (search?.action !== 'enroll' || isDisabled) return;
        setOpen(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({
            to: location.pathname,
            search: ((prev: Record<string, unknown>) => {
                const { action: _omit, ...rest } = prev || {};
                return rest;
            }) as any,
            replace: true,
        });
    }, [location.search, location.pathname, isDisabled, navigate]);

    return (
        <>
            <MyButton
                buttonType="primary"
                scale={scale}
                layoutVariant="default"
                id="enroll-students"
                onClick={() => setOpen(true)}
                disable={isDisabled}
                className={cn(
                    'group flex items-center gap-1.5 px-3 py-1.5 text-xs sm:gap-2 sm:px-8 sm:py-2 sm:text-sm',
                    isDisabled && 'pointer-events-none opacity-55',
                    className
                )}
            >
                <GraduationCap className="size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-4" />
                <span className="truncate">
                    Enroll {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
                </span>
            </MyButton>

            <BulkAssignDialog open={open} onOpenChange={setOpen} initialPackageSessionId={initialPackageSessionId} />
        </>
    );
};
