import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { convertCapitalToTitleCase } from '@/lib/utils';
import { GraduationCap } from '@phosphor-icons/react';

export const BatchCell = ({ batch_id }: { batch_id: string }) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const batch = instituteDetails?.batches_for_sessions?.find((batch) => batch.id == batch_id);

    if (!batch) {
        return <span className="text-xs text-neutral-400">—</span>;
    }

    const level = convertCapitalToTitleCase(batch.level.level_name);
    const pkg = convertCapitalToTitleCase(batch.package_dto.package_name);
    const session = convertCapitalToTitleCase(batch.session.session_name);

    return (
        <div className="flex items-start gap-2">
            <GraduationCap
                size={14}
                weight="duotone"
                className="mt-0.5 shrink-0 text-primary-500"
            />
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium text-neutral-800">
                    {level} {pkg}
                </span>
                <span className="truncate text-[11px] text-neutral-500">{session}</span>
            </div>
        </div>
    );
};
