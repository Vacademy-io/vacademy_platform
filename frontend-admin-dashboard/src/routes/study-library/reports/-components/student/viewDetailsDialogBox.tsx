import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
import { useState, useEffect } from 'react';
import { Row } from '@tanstack/react-table';
import {
    SubjectOverviewColumnType,
    ChapterReport,
    ChapterOverviewStudentColumns,
    CHAPTER_OVERVIEW_STUDENT_WIDTH,
} from '../../-types/types';
import { useMutation } from '@tanstack/react-query';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyTable } from '@/components/design-system/table';
import {
    fetchChapterWiseProgress,
    fetchLearnersChapterWiseProgress,
    exportChapterWiseLearnersReport,
} from '../../-services/utils';
import { usePacageDetails } from '../../-store/usePacageDetails';
import dayjs from 'dayjs';
import { formatToTwoDecimalPlaces, convertMinutesToTimeFormat } from '../../-services/helper';
import { toast } from 'sonner';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';

export const ViewDetails = ({ row }: { row: Row<SubjectOverviewColumnType> }) => {
    const [viewDetailsState, setViewDetailsState] = useState(false);
    const [chapterReportData, setChapterReportData] = useState<ChapterReport>();
    const { pacageSessionId, course, session, level } = usePacageDetails();
    const ChapterWiseMutation = useMutation({
        mutationFn: fetchChapterWiseProgress,
    });
    const LearnersChapterWiseMutation = useMutation({
        mutationFn: fetchLearnersChapterWiseProgress,
    });
    const { isPending: isChapterPending, error: chapterError } = ChapterWiseMutation;
    const { isPending: isLearnerPending, error: learnerError } = LearnersChapterWiseMutation;
    const date = new Date().toString();
    const currDate = dayjs(date).format('DD/MM/YYYY');
    useEffect(() => {
        if (viewDetailsState) {
            if (row.getValue('user_id')) {
                LearnersChapterWiseMutation.mutate(
                    {
                        packageSessionId: pacageSessionId,
                        userId: row.getValue('user_id'),
                        moduleId: row.getValue('module_id'),
                    },
                    {
                        onSuccess: (data) => {
                            setChapterReportData(data);
                        },
                        onError: (error) => {
                            console.error('Error:', error);
                        },
                    }
                );
            } else {
                ChapterWiseMutation.mutate(
                    {
                        packageSessionId: pacageSessionId,
                        moduleId: row.getValue('module_id'),
                    },
                    {
                        onSuccess: (data) => {
                            setChapterReportData(data);
                        },
                        onError: (error) => {
                            console.error('Error:', error);
                        },
                    }
                );
            }
        }
    }, [viewDetailsState]);

    const getLearnersReportDataPDF = useMutation({
        mutationFn: () =>
            exportChapterWiseLearnersReport({
                startDate: '',
                endDate: '',
                packageSessionId: pacageSessionId,
                moduleId: row.getValue('module_id'),
                userId: row.getValue('user_id'),
            }),
        onSuccess: async (response) => {
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `student_chapter_wise_progress_report.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Student Chapter-wise Progress Report PDF exported successfully');
        },
        onError: (error: unknown) => {
            throw error;
        },
    });

    const handleExportPDF = () => {
        getLearnersReportDataPDF.mutate();
    };
    const isExporting = getLearnersReportDataPDF.isPending;

    return (
        <div
            className="cursor-pointer text-primary-500"
            onClick={() => {
                setViewDetailsState(!viewDetailsState);
            }}
        >
            View Details
            <MyDialog
                heading="Module Details Report"
                open={viewDetailsState}
                onOpenChange={setViewDetailsState}
                dialogWidth="w-[800px]"
            >
                <div className="flex flex-col gap-4">
                    <div className="flex flex-row items-center justify-between">
                        <div>Date: {currDate}</div>
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleExportPDF();
                            }}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-500"></div>
                                    <span>Exporting...</span>
                                </div>
                            ) : (
                                'Export'
                            )}
                        </MyButton>
                    </div>
                    <div className="grid grid-cols-3 items-center justify-between gap-4">
                        <div>
                            {getTerminology(ContentTerms.Course, SystemTerms.Course)}: {course}
                        </div>
                        <div>
                            {getTerminology(ContentTerms.Session, SystemTerms.Session)}: {session}
                        </div>
                        <div>
                            {getTerminology(ContentTerms.Level, SystemTerms.Level)}: {level}
                        </div>
                        <div>
                            {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:{' '}
                            {row.getValue('subject')}
                        </div>
                        <div>
                            {getTerminology(ContentTerms.Modules, SystemTerms.Modules)}:{' '}
                            {row.getValue('module')}
                        </div>
                    </div>
                    {(isChapterPending || isLearnerPending) && <DashboardLoader />}
                    {chapterReportData &&
                        chapterReportData.map((chapter) => (
                            <div key={chapter.chapter_id} className="flex flex-col gap-6">
                                <div className="flex flex-row gap-4">
                                    <div className="text-h3 font-[600]">
                                        {getTerminology(
                                            ContentTerms.Chapters,
                                            SystemTerms.Chapters
                                        )}
                                    </div>
                                    <div className="text-h3 text-primary-500">
                                        {chapter.chapter_name}
                                    </div>
                                </div>
                                <MyTable
                                    key={chapter.chapter_id} // Unique key for React list rendering
                                    data={{
                                        content:
                                            chapter.slides?.map((slide) => ({
                                                study_slide: slide.slide_title,
                                                slide_type: slide.slide_source_type,
                                                concentration_score: `${formatToTwoDecimalPlaces(
                                                    slide.avg_concentration_score
                                                )} %`,
                                                batch_concentration_score: `${formatToTwoDecimalPlaces(
                                                    slide.avg_concentration_score
                                                )} %`,
                                                average_time_spent: `${convertMinutesToTimeFormat(
                                                    slide.avg_time_spent
                                                )}`,
                                                last_active: slide.last_active_date || 'N/A',
                                            })) || [],
                                        total_pages: 0,
                                        page_no: 0,
                                        page_size: 10,
                                        total_elements: 0,
                                        last: false,
                                    }}
                                    columns={ChapterOverviewStudentColumns} // Use correct column config
                                    isLoading={isChapterPending || isLearnerPending}
                                    error={chapterError || learnerError}
                                    columnWidths={CHAPTER_OVERVIEW_STUDENT_WIDTH} // Ensure this width config matches
                                    currentPage={0}
                                />
                            </div>
                        ))}
                </div>
            </MyDialog>
        </div>
    );
};
