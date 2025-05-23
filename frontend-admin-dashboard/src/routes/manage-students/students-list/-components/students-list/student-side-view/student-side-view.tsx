import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar';
import { X } from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { DummyProfile } from '@/assets/svgs';
import { StatusChips } from '@/components/design-system/chips';
import { StudentOverview } from './student-overview/student-overview';
import { StudentLearningProgress } from './student-learning-progress/student-learning-progress';
import { StudentTestRecord } from './student-test-records/student-test-record';
import { getPublicUrl } from '@/services/upload_file';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { useStudentSidebar } from '../../../-context/selected-student-sidebar-context';

export const StudentSidebar = ({
    selectedTab,
    examType,
    isStudentList,
    isSubmissionTab,
}: {
    selectedTab?: string;
    examType?: string;
    isStudentList?: boolean;
    isSubmissionTab?: boolean;
}) => {
    const { state } = useSidebar();
    const [category, setCategory] = useState('overview');
    const { toggleSidebar } = useSidebar();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [faceLoader, setFaceLoader] = useState(false);

    const { selectedStudent } = useStudentSidebar();

    useEffect(() => {
        if (state == 'expanded') {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('sidebar-open');
        };
    }, [state]);

    const fetchImageUrl = async () => {
        if (selectedStudent?.face_file_id) {
            try {
                setFaceLoader(true);
                const url = await getPublicUrl(selectedStudent.face_file_id);
                setImageUrl(url);
                setFaceLoader(false);
            } catch (error) {
                console.error('Failed to fetch image URL:', error);
                setFaceLoader(false);
            }
        } else {
            setImageUrl(null);
        }
    };

    useEffect(() => {
        fetchImageUrl();
    }, [selectedStudent, selectedStudent?.face_file_id]);

    return (
        <Sidebar side="right">
            <SidebarContent
                className={`sidebar-content flex flex-col gap-10 border-r-2 border-r-neutral-300 bg-primary-50 p-6 text-neutral-600`}
            >
                <SidebarHeader>
                    <div className={`flex flex-col items-center justify-center gap-10`}>
                        <div className={`flex w-full items-center justify-between`}>
                            <div className="text-h3 font-semibold text-primary-500">
                                Student Profile
                            </div>
                            <X
                                className="size-6 cursor-pointer text-neutral-500"
                                onClick={() => {
                                    toggleSidebar();
                                }}
                            />
                        </div>
                        <div className="flex w-full">
                            <div
                                className={`w-full py-[9px] text-center ${
                                    category == 'overview'
                                        ? 'rounded-lg border border-primary-200 bg-white text-primary-500'
                                        : 'border-none bg-none text-neutral-600'
                                } cursor-pointer text-subtitle`}
                                onClick={() => {
                                    setCategory('overview');
                                }}
                            >
                                Overview
                            </div>
                            <div
                                className={`w-full py-[9px] text-center ${
                                    category == 'learningProgress'
                                        ? 'rounded-lg border border-primary-200 bg-white text-primary-500'
                                        : 'border-none bg-none text-neutral-600'
                                } cursor-pointer text-subtitle`}
                                onClick={() => {
                                    setCategory('learningProgress');
                                }}
                            >
                                Learning Progress
                            </div>
                            <div
                                className={`w-full py-[9px] text-center ${
                                    category == 'testRecord'
                                        ? 'rounded-lg border border-primary-200 bg-white text-primary-500'
                                        : 'border-none bg-none text-neutral-600'
                                } cursor-pointer text-subtitle`}
                                onClick={() => {
                                    setCategory('testRecord');
                                }}
                            >
                                Test Records
                            </div>
                        </div>
                    </div>
                </SidebarHeader>

                <SidebarMenu className="no-scrollbar flex w-full flex-col gap-10 overflow-y-scroll">
                    <SidebarMenuItem className="flex w-full flex-col gap-6">
                        <div className="size-[240px] w-full items-center justify-center">
                            <div className="size-full rounded-full object-cover">
                                {faceLoader ? (
                                    <DashboardLoader />
                                ) : imageUrl == null ? (
                                    <DummyProfile className="size-full" />
                                ) : (
                                    <div className="flex w-full items-center justify-center">
                                        <img
                                            src={imageUrl}
                                            alt="face profile"
                                            className={`size-[240px] rounded-full object-cover`}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex w-full items-center justify-center gap-4">
                            <div className="text-h3 font-semibold text-neutral-600">
                                {selectedStudent?.full_name}
                            </div>
                            <StatusChips status={selectedStudent?.status || 'INACTIVE'} />
                        </div>
                    </SidebarMenuItem>

                    {category == 'overview' && (
                        <StudentOverview isSubmissionTab={isSubmissionTab} />
                    )}
                    {category == 'learningProgress' && (
                        <StudentLearningProgress isSubmissionTab={isSubmissionTab} />
                    )}
                    {category == 'testRecord' && (
                        <StudentTestRecord
                            selectedTab={selectedTab}
                            examType={examType}
                            isStudentList={isStudentList}
                        />
                    )}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
};
