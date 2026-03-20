import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { convertCapitalToTitleCase } from '@/lib/utils';

export const BatchCell = ({ batch_id }: { batch_id: string }) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const batch = instituteDetails?.batches_for_sessions?.find((batch) => batch.id == batch_id);

    const batchName = batch
        ? convertCapitalToTitleCase(batch.level.level_name) +
          ' ' +
          convertCapitalToTitleCase(batch.package_dto.package_name) +
          ' ' +
          convertCapitalToTitleCase(batch.session.session_name)
        : '';

    return (
        <div>
            <p>{batchName}</p>
        </div>
    );
};
