import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { BatchForSessionType } from '@/schemas/student/student-list/institute-schema';
import { StudentTable } from '@/types/student-table-types';

export interface OverviewDetailsType {
    heading: string;
    content: string[];
}

export const OverViewData = ({
    selectedStudent,
    packageSessionDetails,
    password,
}: {
    selectedStudent: StudentTable | null;
    packageSessionDetails: BatchForSessionType | null;
    password: string;
}) => {
    if (selectedStudent == null) return [];

    const na = (value: any) => (value ? value : 'N/A');

    // Course / Level / Session / Enrollment# are now surfaced in the rich
    // OverviewHeader card at the top of the tab, so they're omitted here to
    // avoid duplication. General Details now holds only the demographic-style
    // rows that the header doesn't show.
    const generalDetailsContent = [
        `Gender: ${na(selectedStudent.gender)}`,
        `School: ${na(selectedStudent.linked_institute_name)}`,
    ];

    const locationDetailsContent = [
        `Country: ${na(selectedStudent.country)}`,
        `State: ${na(selectedStudent.region)}`,
        `City: ${na(selectedStudent.city)}`,
        `Pincode: ${na(selectedStudent.pin_code)}`,
        `Address: ${na(selectedStudent.address_line)}`,
    ];

    const overviewSections: OverviewDetailsType[] = [
        {
            heading: `Account Credentials`,
            content: [`Username: ${na(selectedStudent.username)}`, `Password: ${password}`],
        },
        {
            heading: `General Details`,
            content: generalDetailsContent,
        },
        // Attendance is now the first stat tile in OverviewHeader — dropping
        // the redundant Live Session card here.
        // Referral count is filtered out by the empty-row helper unless > 0.
        {
            heading: `Referral Details`,
            content: [`Count: ${na(selectedStudent.referral_count)}`],
        },
        {
            heading: `Contact Information`,
            content: [
                `Mobile No.: ${na(selectedStudent.mobile_number)}`,
                `Email Id: ${na(selectedStudent.email)}`,
            ],
        },
        {
            heading: `Location Details`,
            content: locationDetailsContent,
        },
        {
            heading: "Parent/Guardian's Details",
            content: [
                `Father/Male Guardian's Name: ${na(selectedStudent.fathers_name)}`,
                `Father/Male Guardian's Mobile No.: ${na(selectedStudent.parents_mobile_number)}`,
                `Father/Male Guardian's Email Id: ${na(selectedStudent.parents_email)}`,
                `Mother/Female Guardian's Name: ${na(selectedStudent.mothers_name)}`,
                `Mother/Female Guardian's Mobile No: ${na(selectedStudent.parents_to_mother_mobile_number)}`,
                `Mother/Female Guardian's Email Id: ${na(selectedStudent.parents_to_mother_email)}`,
            ],
        },
    ];

    return overviewSections;
};
