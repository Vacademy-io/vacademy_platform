/**
 * ERP → Admission — the two halves of the same list.
 *
 * "Enrolled Batch" is a student sitting in a batch that actually exists; "Flexi
 * Batch" is one admitted to a course who was never placed in a batch (see
 * -utils/admission-batches). Both reuse the Manage Students list pinned to their
 * own set of batches, so the columns, search, side view and export are the ones
 * staff already know rather than a second table that drifts from it.
 */
import { StudentsListSection } from '@/routes/manage-students/students-list/-components/students-list/student-list-section/students-list-section';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useAdmissionBatchSplit } from '../-utils/admission-batches';

export function AdmissionStudentsPage({ side }: { side: 'enrolled' | 'flexi' }) {
    const { enrolled, flexi, ready } = useAdmissionBatchSplit();
    // Until the institute payload lands both lists are empty, and an empty pin
    // means "no pin" to useStudentTable — which would show every student on both
    // pages rather than neither.
    if (!ready) return <DashboardLoader />;
    return (
        <StudentsListSection
            pinnedPackageSessionIds={side === 'enrolled' ? enrolled : flexi}
            heading={side === 'enrolled' ? 'Enrolled Batch Students' : 'Flexi Batch Students'}
        />
    );
}
