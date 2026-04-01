import { useState } from 'react';
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
                    'group flex items-center gap-2 px-8 py-2 text-sm',
                    isDisabled && 'pointer-events-none opacity-55',
                    className
                )}
            >
                <GraduationCap className="size-4 transition-transform duration-200 group-hover:scale-110" />
                Enroll {getTerminology(RoleTerms.Learner, SystemTerms.Learner)}
            </MyButton>

            <BulkAssignDialog open={open} onOpenChange={setOpen} initialPackageSessionId={initialPackageSessionId} />
        </>
    );
};
