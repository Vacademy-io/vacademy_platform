import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getSystemFieldColumnVisibility } from '@/components/design-system/utils/constants/system-field-columns';
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

    // Honor the system-field toggle (Settings → Custom Fields): a field turned off
    // is omitted here. Derived rows (Course/Level/Session), Address, Pincode and
    // Password have no toggle and always show. Sections with no visible rows drop.
    //
    // NOTE: student-overview.tsx skips the General Details + Contact Information
    // sections at render-time because the rich OverviewHeader / OverviewEnrolment
    // / OverviewContact cards already surface that data. The data shape produced
    // here is still used by other surfaces (legacy drawer, exports) so we keep
    // the full set per main's toggle-aware shape.
    const visibility = getSystemFieldColumnVisibility();
    const show = (accessor: string) => visibility[accessor] !== false;

    const generalDetailsContent = [
        `${getTerminology(ContentTerms.Course, SystemTerms.Course)}: ${na(
            packageSessionDetails?.package_dto.package_name
        )}`,
        `${getTerminology(ContentTerms.Level, SystemTerms.Level)}: ${na(
            packageSessionDetails?.level.level_name
        )}`,
        `${getTerminology(ContentTerms.Session, SystemTerms.Session)}: ${na(
            packageSessionDetails?.session.session_name
        )}`,
        ...(show('institute_enrollment_number')
            ? [`Enrollment No: ${na(selectedStudent.institute_enrollment_number)}`]
            : []),
        ...(show('gender') ? [`Gender: ${na(selectedStudent.gender)}`] : []),
        ...(show('linked_institute_name')
            ? [`School: ${na(selectedStudent.linked_institute_name)}`]
            : []),
    ];

    const locationDetailsContent = [
        ...(show('country') ? [`Country: ${na(selectedStudent.country)}`] : []),
        ...(show('region') ? [`State: ${na(selectedStudent.region)}`] : []),
        ...(show('city') ? [`City: ${na(selectedStudent.city)}`] : []),
        ...(show('pin_code') ? [`Pincode: ${na(selectedStudent.pin_code)}`] : []),
        ...(show('address_line') ? [`Address: ${na(selectedStudent.address_line)}`] : []),
    ];

    const contactContent = [
        ...(show('mobile_number') ? [`Mobile No.: ${na(selectedStudent.mobile_number)}`] : []),
        ...(show('email') ? [`Email Id: ${na(selectedStudent.email)}`] : []),
    ];

    const guardianContent = [
        ...(show('fathers_name')
            ? [`Father/Male Guardian's Name: ${na(selectedStudent.fathers_name)}`]
            : []),
        ...(show('parents_mobile_number')
            ? [`Father/Male Guardian's Mobile No.: ${na(selectedStudent.parents_mobile_number)}`]
            : []),
        ...(show('parents_email')
            ? [`Father/Male Guardian's Email Id: ${na(selectedStudent.parents_email)}`]
            : []),
        ...(show('mothers_name')
            ? [`Mother/Female Guardian's Name: ${na(selectedStudent.mothers_name)}`]
            : []),
        ...(show('parents_to_mother_mobile_number')
            ? [
                  `Mother/Female Guardian's Mobile No: ${na(
                      selectedStudent.parents_to_mother_mobile_number
                  )}`,
              ]
            : []),
        ...(show('parents_to_mother_email')
            ? [`Mother/Female Guardian's Email Id: ${na(selectedStudent.parents_to_mother_email)}`]
            : []),
    ];

    const overviewSections: OverviewDetailsType[] = [
        {
            heading: `Account Credentials`,
            content: [
                ...(show('username') ? [`Username: ${na(selectedStudent.username)}`] : []),
                `Password: ${password}`,
            ],
        },
        {
            heading: `General Details`,
            content: generalDetailsContent,
        },
        // Live Session attendance is also surfaced as the Attendance stat
        // tile in OverviewHeader; the section here adds a row-style view for
        // surfaces that don't render the rich header (drawer, exports).
        // Both are gated by the system-field toggle per main's pattern.
        ...(show('attendance_percent')
            ? [
                  {
                      heading: `${getTerminology(ContentTerms.LiveSession, SystemTerms.LiveSession)}`,
                      content: [`Attendance: ${na(selectedStudent.attendance_percent)}`],
                  },
              ]
            : []),
        ...(show('referral_count')
            ? [
                  {
                      heading: `Referral Details`,
                      content: [`Count: ${na(selectedStudent.referral_count)}`],
                  },
              ]
            : []),
        {
            heading: `Contact Information`,
            content: contactContent,
        },
        {
            heading: `Location Details`,
            content: locationDetailsContent,
        },
        {
            heading: "Parent/Guardian's Details",
            content: guardianContent,
        },
    ];

    // Drop sections whose rows were all toggled off.
    return overviewSections.filter((section) => section.content.length > 0);
};
