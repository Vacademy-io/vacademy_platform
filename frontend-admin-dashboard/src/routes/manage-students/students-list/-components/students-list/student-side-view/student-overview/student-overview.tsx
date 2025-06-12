import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { ProgressBar } from '@/components/design-system/progress-bar';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import { useEffect, useState } from 'react';
import { OverViewData, OverviewDetailsType } from './overview';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { EditStudentDetails } from './EditStudentDetails';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { MyButton } from '@/components/design-system/button';
import { useDialogStore } from '@/routes/manage-students/students-list/-hooks/useDialogStore';
import { useGetStudentDetails } from '@/services/get-student-details';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { StudentTable } from '@/types/student-table-types';

export const StudentOverview = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();

    const [overviewData, setOverviewData] = useState<OverviewDetailsType[] | null>(null);
    const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(0);
    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;
    const { data: studentDetails, isLoading, isError } = useGetStudentDetails(userId || '');

    const { getDetailsFromPackageSessionId, instituteDetails } = useInstituteDetailsStore();

    const { getCredentials } = useStudentCredentialsStore();
    const [password, setPassword] = useState(
        getCredentials(isSubmissionTab ? selectedStudent?.id || '' : selectedStudent?.user_id || '')
            ?.password || 'password not found'
    );
    const { openIndividualShareCredentialsDialog } = useDialogStore();

    useEffect(() => {
        if (selectedStudent) {
            const credentials = getCredentials(
                isSubmissionTab ? selectedStudent.id : selectedStudent.user_id
            );
            setPassword(credentials?.password || 'password not found');
        }
    }, [selectedStudent]);

    useEffect(() => {
        const details = getDetailsFromPackageSessionId({
            packageSessionId: isSubmissionTab
                ? selectedStudent?.package_id || ''
                : selectedStudent?.package_session_id || '',
        });
        const student: StudentTable | null = {
            id: studentDetails?.id || '',
            username: studentDetails?.username || '',
            user_id: selectedStudent?.id || '',
            email: studentDetails?.email || '',
            full_name: studentDetails?.full_name || '',
            address_line: studentDetails?.address_line || '',
            region: studentDetails?.region || '',
            city: studentDetails?.city || '',
            pin_code: studentDetails?.pin_code || '',
            mobile_number: studentDetails?.mobile_number || '',
            date_of_birth: studentDetails?.date_of_birth || '',
            gender: studentDetails?.gender || '',
            father_name: '',
            mother_name: '',
            parents_mobile_number: '',
            parents_email: '',
            linked_institute_name: '',
            created_at: '',
            updated_at: '',
            package_session_id: '',
            institute_enrollment_id: '',
            status: 'ACTIVE',
            session_expiry_days: 0,
            institute_id: '',
            expiry_date: 0,
            face_file_id: studentDetails?.face_file_id || '',
            attempt_id: '',
            parents_to_mother_mobile_number: '',
            parents_to_mother_email: '',
            package_id: selectedStudent?.package_id || '',
        };

        const learner = isSubmissionTab ? student : selectedStudent;
        setOverviewData(
            OverViewData({
                selectedStudent: learner,
                packageSessionDetails: details,
                password: password,
            })
        );

        // Calculate days until expiry
        if (selectedStudent?.expiry_date) {
            const expiryDate = new Date(selectedStudent.expiry_date);
            const currentDate = new Date();

            // Calculate the difference in milliseconds
            const diffTime = expiryDate.getTime() - currentDate.getTime();

            // Convert to days and round down
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            // Set the days until expiry (0 if negative)
            setDaysUntilExpiry(diffDays > 0 ? diffDays : 0);
        } else {
            setDaysUntilExpiry(0);
        }
    }, [selectedStudent, instituteDetails, password, studentDetails]);

    if (isLoading) {
        return <DashboardLoader />;
    }

    if (isError) {
        return <div>Error fetching student details</div>;
    }

    return (
        <div className="flex flex-col gap-10 text-neutral-600">
            <EditStudentDetails />
            <SidebarMenuItem className="flex w-full flex-col gap-2">
                <div className="flex gap-2">
                    <div className="text-subtitle font-semibold">Session Expiry (Days)</div>
                    <span
                        className={`text-subtitle font-semibold ${
                            daysUntilExpiry >= 180
                                ? 'text-success-600'
                                : daysUntilExpiry >= 30
                                  ? 'text-warning-600'
                                  : 'text-danger-600'
                        }`}
                    >
                        {daysUntilExpiry}
                    </span>
                </div>
                <ProgressBar progress={daysUntilExpiry} />
            </SidebarMenuItem>
            <SidebarMenuItem className="flex flex-col gap-10">
                {selectedStudent != null ? (
                    overviewData?.map((studentDetail, key) => (
                        <div key={key} className="flex flex-col gap-10">
                            <div className="flex justify-between">
                                <div className="flex justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-subtitle font-semibold text-neutral-600">
                                            {studentDetail.heading}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            {studentDetail.content &&
                                            studentDetail.content.length > 0 ? (
                                                studentDetail.content.map((obj, key2) => (
                                                    <div className="text-body" key={key2}>
                                                        {obj == undefined ? (
                                                            <p className="text-primary-500">
                                                                No data available
                                                            </p>
                                                        ) : (
                                                            <p>{obj}</p>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="py-4 text-center text-subtitle">
                                                    {' '}
                                                    Student details not available
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {key === 0 && (
                                    <MyButton
                                        buttonType="secondary"
                                        scale="large"
                                        onClick={() =>
                                            selectedStudent &&
                                            openIndividualShareCredentialsDialog(selectedStudent)
                                        }
                                    >
                                        Share Credentials
                                    </MyButton>
                                )}
                            </div>
                            <Separator />
                        </div>
                    ))
                ) : (
                    <p className="py-4 text-center text-subtitle">No overview data available</p>
                )}
            </SidebarMenuItem>
        </div>
    );
};
