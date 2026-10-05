import { useMemo } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

/**
 * Splits an institute's batches into the two ERP → Admission lists.
 *
 * A batch is "real" when someone named it. The migration that brought these
 * institutes over created one placeholder session per course for the admissions
 * whose source sheet had no batch against them — those carry no name at all, or
 * the literal "DEFAULT" / "General". So:
 *
 *   Enrolled Batch — the student sits in a batch that actually exists
 *   Flexi Batch    — admitted to the course, never placed in a batch
 *
 * Classified here rather than on the server because the institute payload
 * already carries every package_session id and name, so this costs no request.
 */
const PLACEHOLDER_NAMES = new Set(['DEFAULT', 'GENERAL']);

export function isRealBatchName(name: string | null | undefined): boolean {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return false;
    return !PLACEHOLDER_NAMES.has(trimmed.toUpperCase());
}

export interface AdmissionBatchSplit {
    /** package_session ids that carry a real batch name. */
    enrolled: string[];
    /** package_session ids that are a placeholder — no batch was ever assigned. */
    flexi: string[];
    /** False while the institute payload is still loading; both lists are empty then. */
    ready: boolean;
}

export function useAdmissionBatchSplit(): AdmissionBatchSplit {
    const { getPackageWiseLevels } = useInstituteDetailsStore();
    return useMemo(() => {
        const enrolled: string[] = [];
        const flexi: string[] = [];
        for (const pkg of getPackageWiseLevels() ?? []) {
            for (const level of pkg.level ?? []) {
                if (!level.package_session_id) continue;
                (isRealBatchName(level.name) ? enrolled : flexi).push(level.package_session_id);
            }
        }
        return { enrolled, flexi, ready: enrolled.length + flexi.length > 0 };
    }, [getPackageWiseLevels]);
}
