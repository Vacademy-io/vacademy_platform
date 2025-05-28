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
    if (selectedStudent == null) return null;

    const OverviewDetails: OverviewDetailsType[] = [
        {
            heading: `Account Credentials`,
            content: [`Username: ${selectedStudent.username}`, `Password: ${password}`],
        },
        {
            heading: `General Details`,
            content: [
                `Course: ${
                    packageSessionDetails?.package_dto.package_name == undefined
                        ? 'N/A'
                        : packageSessionDetails?.package_dto.package_name
                }`,
                `Level: ${
                    packageSessionDetails?.level.level_name == undefined
                        ? 'N/A'
                        : packageSessionDetails?.level.level_name
                }`,
                `Session: ${
                    packageSessionDetails?.session.session_name == undefined
                        ? 'N/A'
                        : packageSessionDetails?.session.session_name
                }`,
                `Enrollment No: ${
                    selectedStudent.institute_enrollment_id == undefined
                        ? 'N/A'
                        : selectedStudent.institute_enrollment_id
                }`,
                `Gender: ${selectedStudent.gender == undefined ? 'N/A' : selectedStudent.gender}`,
                `School: ${
                    selectedStudent.linked_institute_name == undefined
                        ? 'N/A'
                        : selectedStudent.linked_institute_name
                }`,
            ],
        },
        {
            heading: `Contact Information`,
            content: [
                `Mobile No.: ${selectedStudent.mobile_number}`,
                `Email Id: ${selectedStudent.email}`,
            ],
        },
        {
            heading: `Location Details`,
            content: [
                `State: ${selectedStudent.region != null ? selectedStudent.region : 'N/A'} `,
                `City: ${selectedStudent.city != null ? selectedStudent.city : 'N/A'}`,
            ],
        },
        {
            heading: `Parent/Guardian's Details`,
            content: [
                `Father's Name: ${selectedStudent.father_name}`,
                `Mother's Name: ${selectedStudent.mother_name}`,
                `Guardian's Name: -`,
                `Mobile No.: ${selectedStudent.parents_mobile_number}`,
                `Email Id: ${selectedStudent.parents_email}`,
            ],
        },
    ];
    return OverviewDetails;
};
