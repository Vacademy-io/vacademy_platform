import { ColumnDef } from '@tanstack/react-table';
import { ViewDetails } from '../-components/batch/viewDetailsDialogBox';
import { ViewDetails as ViewDetailsStudent } from '../-components/student/viewDetailsDialogBox';

export type ColumnWidthConfig = Record<string, string>;

export interface DailyLearnerTimeSpent {
    activity_date: string;
    avg_daily_time_minutes: number;
}

export interface BatchReportResponse {
    percentage_course_completed: number;
    avg_time_spent_in_minutes: number;
    percentage_concentration_score: number;
    daily_time_spent: DailyLearnerTimeSpent[];
}

export interface LearnersReportResponse {
    learner_progress_report: BatchReportResponse;
    batch_progress_report: BatchReportResponse;
}

export interface LearnerReport {
    daily_avg_time: number;
    avg_concentration: number;
    rank: number;
    total_time: number;
    user_id: string;
    email: string;
    full_name: string;
}

export const activityLogColumns: ColumnDef<{ date: string; timeSpent: string }>[] = [
    {
        accessorKey: 'date',
        header: 'Date',
    },
    {
        accessorKey: 'timeSpent',
        header: 'Time Spent',
    },
];

export interface TransformedReport {
    date: string;
    timeSpent: string;
    timeSpentBatch: string;
}
export const learnersReportColumns: ColumnDef<TransformedReport>[] = [
    {
        accessorKey: 'date',
        header: 'Date',
    },
    {
        accessorKey: 'timeSpent',
        header: 'Time Spent',
    },
    {
        accessorKey: 'timeSpentBatch',
        header: 'Time Spent By Batch (Avg)',
    },
];

export interface LeaderBoardColumnType {
    rank: string;
    name: string;
    score: string;
    average: string;
    totalTime: string;
}

export const leaderBoardColumns: ColumnDef<LeaderBoardColumnType>[] = [
    {
        accessorKey: 'rank',
        header: 'Rank',
    },
    {
        accessorKey: 'name',
        header: 'Learner Name',
    },
    {
        accessorKey: 'score',
        header: 'Concentration Score',
    },
    {
        accessorKey: 'average',
        header: 'Daily Time Spent (Avg)',
    },
    {
        accessorKey: 'totalTime',
        header: 'Total Time',
    },
];

export const CONCENTRATION_SCORE: ColumnWidthConfig = {
    date: 'w-[60px]',
    timeSpent: 'w-[50px]',
};
export const LEARNERS_REPORTS_COLUMNS: ColumnWidthConfig = {
    date: 'w-[70px]',
    timeSpent: 'w-[50px]',
    timeSpentBatch: 'w-[70px]',
};

export const LEADERBOARD_WIDTH: Record<keyof LeaderBoardColumnType, string> = {
    rank: 'w-[60px]',
    name: 'w-[150px]',
    score: 'w-[100px]', // Concentration Score column width
    average: 'w-[120px]',
    totalTime: 'w-[100px]',
};

interface Module {
    module_id: string;
    module_name: string;
    module_completion_percentage: number;
    avg_time_spent_minutes: number;
}

interface SubjectProgress {
    subject_id: string;
    subject_name: string;
    modules: Module[];
}

export type SubjectProgressResponse = SubjectProgress[];

export interface SubjectOverviewColumnType {
    subject: string;
    module: string;
    module_completed: string;
    module_completed_by_batch: string;
    average_time_spent: string;
    average_time_spent_by_batch: string;
    details?: string;
    module_id: string;
    user_id?: string;
}
export const SubjectOverviewColumns: ColumnDef<SubjectOverviewColumnType>[] = [
    {
        accessorKey: 'subject',
        header: 'Subject',
    },
    {
        accessorKey: 'module',
        header: 'Module',
    },
    {
        accessorKey: 'module_id',
        header: '',
    },
    {
        accessorKey: 'module_completed',
        header: 'Module Completed',
    },
    {
        accessorKey: 'module_completed_by_batch',
        header: 'Module completed by batch',
    },
    {
        accessorKey: 'average_time_spent_by_batch',
        header: 'Daily Time spent by batch (Avg)',
    },
    {
        accessorKey: 'average_time_spent',
        header: 'Daily Time spent (Avg)',
    },
    {
        accessorKey: 'details',
        header: '',
        cell: ({ row }) => <ViewDetailsStudent row={row} />,
    },
    {
        accessorKey: 'user_id',
        header: '',
    },
];

export const SUBJECT_OVERVIEW_WIDTH: Record<keyof SubjectOverviewColumnType, string> = {
    subject: 'w-[200px]',
    module: 'w-[200px]',
    module_completed: 'w-[200px]',
    module_completed_by_batch: 'w-[200px]',
    average_time_spent: 'w-[200px]',
    average_time_spent_by_batch: 'w-[200px]',
    details: 'w-[100px]',
    module_id: 'w-[0px]',
    user_id: 'w-[0px]',
};

export interface SubjectOverviewBatchColumnType {
    subject: string;
    module: string;
    module_completed_by_batch: string;
    average_time_spent_by_batch: string;
    details?: string;
    module_id: string;
    user_id?: string;
}
export const SubjectOverviewBatchColumns: ColumnDef<SubjectOverviewBatchColumnType>[] = [
    {
        accessorKey: 'subject',
        header: 'Subject',
    },
    {
        accessorKey: 'module',
        header: 'Module',
    },
    {
        accessorKey: 'module_id',
        header: '',
    },
    {
        accessorKey: 'module_completed_by_batch',
        header: 'Module completed by batch',
    },
    {
        accessorKey: 'average_time_spent_by_batch',
        header: 'Daily Time spent by batch (Avg)',
    },
    {
        accessorKey: 'details',
        header: '',
        cell: ({ row }) => <ViewDetails row={row} />,
    },
    {
        accessorKey: 'user_id',
        header: '',
    },
];

export const SUBJECT_OVERVIEW_BATCH_WIDTH: Record<keyof SubjectOverviewBatchColumnType, string> = {
    subject: 'w-[200px]',
    module: 'w-[200px]',
    module_completed_by_batch: 'w-[200px]',
    average_time_spent_by_batch: 'w-[200px]',
    details: 'w-[200px]',
    module_id: 'w-[0px]',
    user_id: 'w-[0px]',
};

export const df = () => {
    return <div>nothing</div>;
};
export interface Slide {
    slide_id: string;
    slide_title: string;
    slide_source_type: string;
    avg_time_spent: number;
    avg_concentration_score: number;
}

export interface Chapter {
    chapter_id: string;
    chapter_name: string;
    slides: Slide[];
}

export type ChapterReport = Chapter[];

export interface ChapterOverviewColumnType {
    study_slide: string;
    batch_concentration_score: string;
    average_time_spent: string;
}

export const ChapterOverviewColumns: ColumnDef<ChapterOverviewColumnType>[] = [
    {
        accessorKey: 'study_slide',
        header: 'Study Slide',
    },
    {
        accessorKey: 'batch_concentration_score',
        header: 'Batch Concentration Score (Avg)',
    },
    {
        accessorKey: 'average_time_spent',
        header: 'Time Spent (Avg)',
    },
];
export const CHAPTER_OVERVIEW_WIDTH: Record<keyof ChapterOverviewColumnType, string> = {
    study_slide: 'w-[300px]',
    batch_concentration_score: 'w-[300px]',
    average_time_spent: 'w-[300px]',
};

export interface ChapterOverviewStudentColumnType {
    study_slide: string;
    batch_concentration_score: string;
    concentration_score: string;
    average_time_spent: string;
    last_active: string;
}

export const ChapterOverviewStudentColumns: ColumnDef<ChapterOverviewStudentColumnType>[] = [
    {
        accessorKey: 'study_slide',
        header: 'Study Slide',
    },
    {
        accessorKey: 'concentration_score',
        header: 'Concentration Score',
    },
    {
        accessorKey: 'batch_concentration_score',
        header: 'Batch Concentration Score (Avg)',
    },
    {
        accessorKey: 'average_time_spent',
        header: 'Time Spent',
    },
    {
        accessorKey: 'last_active',
        header: 'Last Active',
    },
];
export const CHAPTER_OVERVIEW_STUDENT_WIDTH: Record<
    keyof ChapterOverviewStudentColumnType,
    string
> = {
    study_slide: 'w-[300px]',
    batch_concentration_score: 'w-[300px]',
    concentration_score: 'w-[300px]',
    average_time_spent: 'w-[300px]',
    last_active: 'w-[300px]',
};

interface SlideDetail {
    slide_id: string;
    slide_title: string;
    chapter_id: string;
    chapter_name: string;
    module_id: string;
    module_name: string;
    subject_id: string;
    subject_name: string;
    concentration_score: number;
    time_spent: string;
}

export interface SlideData {
    date: string;
    slide_details: SlideDetail[];
}
export interface SlidesColumnType {
    study_slide: string;
    subject: string;
    module: string;
    chapter: string;
    concentration_score: string;
    time_spent: string;
}

export const SlidesColumns: ColumnDef<SlidesColumnType>[] = [
    {
        accessorKey: 'study_slide',
        header: 'Study Slide',
    },
    {
        accessorKey: 'subject',
        header: 'Suject',
    },
    {
        accessorKey: 'module',
        header: 'Module',
    },
    {
        accessorKey: 'chapter',
        header: 'Chapter',
    },
    {
        accessorKey: 'concentration_score',
        header: 'Concentration Score',
    },
    {
        accessorKey: 'time_spent',
        header: 'Time Spent',
    },
];
export const SLIDES_WIDTH: Record<keyof SlidesColumnType, string> = {
    study_slide: 'min-w-[300px]',
    subject: 'w-[200px]',
    module: 'w-[200px]',
    chapter: 'w-[200px]',
    concentration_score: 'w-[150px]',
    time_spent: 'w-[150px]',
};

interface ProgressReportSetting {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
}

export interface RoleSetting {
    comma_separated_communication_types: string;
    learner_progress_report: ProgressReportSetting;
    batch_progress_report: ProgressReportSetting;
    comma_separated_email_ids: string | null;
    comma_separated_mobile_number: string | null;
}

export interface InstituteSettingResponse {
    learner_setting: RoleSetting;
    parent_setting: RoleSetting;
}

export enum RoleSettingEnum {
    LEARNER = 'learner_setting',
    PARENT = 'parent_setting',
}

export enum CommunicationTypeEnum {
    EMAIL = 'EMAIL',
    WHATSAPP = 'WHATSAPP',
}

export enum ReportDurationEnum {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

export enum ReportTypeEnum {
    LEARNER_PROGRESS = 'learner_progress_report',
    BATCH_PROGRESS = 'batch_progress_report',
}

export enum commaSeperatedType {
    EMAIL = 'comma_separated_email_ids',
    MOBILE = 'comma_separated_mobile_number',
}

export interface MultipleInputProps {
    itemsList: string[];
    onListChange: (
        role: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT,
        commaSeperatedType: commaSeperatedType,
        updatedList: string[]
    ) => void;
    inputType: 'email' | 'mobile';
    role: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT;
    commaSeperatedType: commaSeperatedType;
}
