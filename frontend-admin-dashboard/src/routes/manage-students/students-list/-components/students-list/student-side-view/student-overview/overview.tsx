import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { StudentTable } from '@/types/student-table-types';

/** One label/value pair in an overview section. Structured (not "Label: value"
 *  strings) so values containing ':' render intact and copy cleanly. */
export interface OverviewField {
    label: string;
    value: string;
    /** Never echo the value in copy toasts when true (e.g. passwords). */
    isSecret?: boolean;
}

export interface OverviewDetailsType {
    /** Stable section key — drives icon selection in the consumer. */
    id: string;
    heading: string;
    content: OverviewField[];
}

export const OverViewData = ({
    selectedStudent,
    packageSessionDetails,
    password,
}: {
    selectedStudent: StudentTable | null;
    packageSessionDetails: BatchForSessionType | null;
    password: string;
}): OverviewDetailsType[] => {
    if (selectedStudent == null) return [];

    const na = (value: unknown): string =>
        value === null || value === undefined || value === '' ? 'N/A' : String(value);

    const overviewSections: OverviewDetailsType[] = [
        {
            id: 'credentials',
            heading: 'Account Credentials',
            content: [
                { label: 'Username', value: na(selectedStudent.username) },
                { label: 'Password', value: password, isSecret: true },
            ],
        },
        {
            id: 'general',
            heading: 'General Details',
            content: [
                {
                    label: getTerminology(ContentTerms.Course, SystemTerms.Course),
                    value: na(packageSessionDetails?.package_dto.package_name),
                },
                {
                    label: getTerminology(ContentTerms.Level, SystemTerms.Level),
                    value: na(packageSessionDetails?.level.level_name),
                },
                {
                    label: getTerminology(ContentTerms.Session, SystemTerms.Session),
                    value: na(packageSessionDetails?.session.session_name),
                },
                { label: 'Enrollment No', value: na(selectedStudent.institute_enrollment_number) },
                { label: 'Gender', value: na(selectedStudent.gender) },
                { label: 'School', value: na(selectedStudent.linked_institute_name) },
            ],
        },
        {
            id: 'liveSession',
            heading: getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession),
            content: [{ label: 'Attendance', value: na(selectedStudent.attendance_percent) }],
        },
        {
            id: 'referral',
            heading: 'Referral Details',
            content: [{ label: 'Count', value: na(selectedStudent.referral_count) }],
        },
        {
            id: 'contact',
            heading: 'Contact Information',
            content: [
                { label: 'Mobile No.', value: na(selectedStudent.mobile_number) },
                { label: 'Email Id', value: na(selectedStudent.email) },
            ],
        },
        {
            id: 'location',
            heading: 'Location Details',
            content: [
                { label: 'Country', value: na(selectedStudent.country) },
                { label: 'State', value: na(selectedStudent.region) },
                { label: 'City', value: na(selectedStudent.city) },
                { label: 'Pincode', value: na(selectedStudent.pin_code) },
                { label: 'Address', value: na(selectedStudent.address_line) },
            ],
        },
        {
            id: 'parents',
            heading: "Parent/Guardian's Details",
            content: [
                { label: "Father/Male Guardian's Name", value: na(selectedStudent.fathers_name) },
                {
                    label: "Father/Male Guardian's Mobile No.",
                    value: na(selectedStudent.parents_mobile_number),
                },
                {
                    label: "Father/Male Guardian's Email Id",
                    value: na(selectedStudent.parents_email),
                },
                { label: "Mother/Female Guardian's Name", value: na(selectedStudent.mothers_name) },
                {
                    label: "Mother/Female Guardian's Mobile No",
                    value: na(selectedStudent.parents_to_mother_mobile_number),
                },
                {
                    label: "Mother/Female Guardian's Email Id",
                    value: na(selectedStudent.parents_to_mother_email),
                },
            ],
        },
    ];

    return overviewSections;
};
