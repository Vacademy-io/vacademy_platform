import { useMemo } from 'react';
import {
    SearchableSelect,
    type SearchableSelectOption,
} from '@/components/design-system/searchable-select';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { SystemTerms } from '@/routes/settings/-components/NamingSettings';

/** Sentinel for "no batch filter" — institute-wide, the default. */
export const ALL_BATCHES = 'ALL';

/**
 * Top-level batch scope for the whole page.
 *
 * <p>Uses `SearchableSelect`, not `MyDropdown`: the design system requires long option lists to be
 * searchable (>~8), and an institute routinely has dozens of batches — a plain menu is unusable at
 * that length. It is also value-based, so selection no longer has to be matched back by label.
 *
 * <p>Reads `batches_for_sessions` from the institute details store — the same source the Planning
 * filters use — so the "Course - Level - Session" label format matches what admins already
 * recognise elsewhere. Batch wording follows the institute's own naming settings.
 *
 * <p>Single-select rather than Planning's multi-select chips, and deliberately not the three-step
 * PackageSelector: this answers "which batch am I looking at", so one compact control that can
 * also mean "all of them" is the right shape.
 */
export default function BatchFilter({
    value,
    onChange,
}: {
    value: string;
    onChange: (packageSessionId: string) => void;
}) {
    const { instituteDetails } = useInstituteDetailsStore();
    const batchTerm = getTerminology(SystemTerms.Batch, 'Batch');
    const allLabel = `All ${batchTerm.toLowerCase()}es`;

    const options: SearchableSelectOption[] = useMemo(() => {
        const batches = (instituteDetails?.batches_for_sessions ?? [])
            .map((batch) => ({
                value: batch.id,
                // Skip missing parts rather than rendering "Course -  - " for partial data.
                label: [
                    batch.package_dto?.package_name,
                    batch.level?.level_name,
                    batch.session?.session_name,
                ]
                    .filter(Boolean)
                    .join(' - '),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        return [{ value: ALL_BATCHES, label: allLabel }, ...batches];
    }, [instituteDetails, allLabel]);

    return (
        <div className="w-64">
            <SearchableSelect
                options={options}
                value={value}
                onChange={onChange}
                placeholder={allLabel}
                searchPlaceholder={`Search ${batchTerm.toLowerCase()}…`}
                emptyText={`No ${batchTerm.toLowerCase()} found.`}
            />
        </div>
    );
}
