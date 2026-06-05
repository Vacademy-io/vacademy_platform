import { ClipboardText, Phone } from '@phosphor-icons/react';
import { ProfileSectionCard, ProfileFieldRow } from '../profile-ui';
import { StudentTable } from '@/types/student-table-types';

/**
 * Overview Bottom Grid — the 2-column layout below Quick Actions per the
 * Vacademy design handoff.
 *
 * Phase A.2 ships the two data-driven cards we can fully populate today:
 *   Left  → Enrolment Details (Plan / Enrollment# / Session / Gender / School)
 *   Right → Contact (Mobile / Email with copy buttons)
 *
 * Continue Learning (left, with ProgressRing) and Recent Activity (right,
 * with lead timeline events) come in Phase A.3 once their react-query
 * loaders are wired in.
 *
 * Cards render only the rows with real values, and a card itself is hidden
 * when it has zero meaningful rows — never a wall of em-dashes.
 *
 * Responsive: 2-col on md+ screens, stacks to 1-col below md so the drawer
 * width settings (compact 640 / standard 780 / wide 960) all read well.
 */
export const OverviewBottomGrid = ({
    student,
    course,
    level,
    session,
    plan,
    onCopy,
    copiedField,
}: {
    student: StudentTable | null;
    course?: string | null;
    level?: string | null;
    session?: string | null;
    /** Plan label (e.g. "Paid courses · Basic"). When absent, falls back to
        course + level joined with "·". */
    plan?: string | null;
    onCopy: (value: string, label: string) => void;
    copiedField: string;
}) => {
    if (!student) return null;

    const enrollmentNo = student.institute_enrollment_number;
    const gender = student.gender && student.gender.trim() !== '' ? student.gender : null;
    const school =
        student.linked_institute_name && student.linked_institute_name.trim() !== ''
            ? student.linked_institute_name
            : null;
    const mobile =
        student.mobile_number && student.mobile_number.trim() !== ''
            ? student.mobile_number
            : null;
    const email = student.email && student.email.trim() !== '' ? student.email : null;

    const planLine = plan || [course, level].filter(Boolean).join(' · ') || null;

    const enrolmentRows: Array<{ label: string; value: string }> = [];
    if (planLine) enrolmentRows.push({ label: 'Plan', value: planLine });
    if (enrollmentNo) enrolmentRows.push({ label: 'Enrollment No', value: enrollmentNo });
    if (session) enrolmentRows.push({ label: 'Session', value: session });
    if (gender) enrolmentRows.push({ label: 'Gender', value: gender });
    if (school) enrolmentRows.push({ label: 'School', value: school });

    const contactRows: Array<{ label: string; value: string }> = [];
    if (mobile) contactRows.push({ label: 'Mobile No.', value: mobile });
    if (email) contactRows.push({ label: 'Email', value: email });

    // Both cards empty → nothing to show.
    if (enrolmentRows.length === 0 && contactRows.length === 0) return null;

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {enrolmentRows.length > 0 && (
                <ProfileSectionCard
                    icon={ClipboardText}
                    heading="Enrolment Details"
                >
                    <dl className="divide-y divide-border">
                        {enrolmentRows.map((r) => (
                            <ProfileFieldRow
                                key={r.label}
                                label={r.label}
                                value={r.value}
                                copied={copiedField === r.label}
                                onCopy={() => onCopy(r.value, r.label)}
                            />
                        ))}
                    </dl>
                </ProfileSectionCard>
            )}
            {contactRows.length > 0 && (
                <ProfileSectionCard icon={Phone} heading="Contact">
                    <dl className="divide-y divide-border">
                        {contactRows.map((r) => (
                            <ProfileFieldRow
                                key={r.label}
                                label={r.label}
                                value={r.value}
                                copied={copiedField === r.label}
                                onCopy={() => onCopy(r.value, r.label)}
                            />
                        ))}
                    </dl>
                </ProfileSectionCard>
            )}
        </div>
    );
};
