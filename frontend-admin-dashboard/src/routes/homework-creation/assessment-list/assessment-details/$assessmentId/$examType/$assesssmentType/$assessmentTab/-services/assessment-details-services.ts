import {
    GET_ADMIN_PARTICIPANTS,
    GET_ASSESSMENT_TOTAL_MARKS_URL,
    GET_ATTEMPT_DATA,
    GET_BATCH_DETAILS_URL,
    GET_EXPORT_CSV_URL_LEADERBOARD,
    GET_EXPORT_CSV_URL_RANK_MARK,
    GET_EXPORT_CSV_URL_RESPONDENT_LIST,
    GET_EXPORT_CSV_URL_SUBMISSIONS_LIST,
    GET_EXPORT_PDF_URL_LEADERBOARD,
    GET_EXPORT_PDF_URL_QUESTION_INSIGHTS,
    GET_EXPORT_PDF_URL_RANK_MARK,
    GET_EXPORT_PDF_URL_RESPONDENT_LIST,
    GET_EXPORT_PDF_URL_STUDENT_REPORT,
    GET_EXPORT_PDF_URL_SUBMISSIONS_LIST,
    GET_INDIVIDUAL_STUDENT_DETAILS_URL,
    GET_LEADERBOARD_URL,
    GET_OVERVIEW_URL,
    GET_PARTICIPANTS_QUESTION_WISE,
    GET_QUESTIONS_INSIGHTS_URL,
    GET_RELEASE_STUDENT_RESULT,
    GET_REVALUATE_STUDENT_RESULT,
    PRIVATE_ADD_QUESTIONS,
    STUDENT_REPORT_DETAIL_URL,
    STUDENT_REPORT_URL,
    UPDATE_ATTEMPT,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AssessmentStudentLeaderboardInterface } from '../-components/AssessmentStudentLeaderboard';
import { AssessmentDetailQuestions } from '../-utils/assessment-details-interface';
import {
    SelectedReleaseResultFilterInterface,
    SelectedSubmissionsFilterInterface,
} from '../-components/AssessmentSubmissionsTab';
import { StudentReportFilterInterface } from '@/routes/manage-students/students-list/-components/students-list/student-side-view/student-test-records/student-test-record';
import { SelectedFilterQuestionWise } from '@/types/assessments/student-questionwise-status';
import { SelectedFilterRevaluateInterface } from '@/types/assessments/assessment-revaluate-question-wise';
import { AssessmentParticipantsInterface } from '../-components/AssessmentParticipantsList';

export const savePrivateQuestions = async (questions: AssessmentDetailQuestions) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: PRIVATE_ADD_QUESTIONS,
        data: questions,
    });
    return response?.data;
};

export const getOverviewDetials = async (assessmentId: string, instituteId: string | undefined) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_OVERVIEW_URL,
        params: {
            assessmentId,
            instituteId,
        },
    });
    return response?.data;
};

export const getQuestionsInsightsData = async (
    assessmentId: string,
    instituteId: string | undefined,
    sectionId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_QUESTIONS_INSIGHTS_URL,
        params: {
            assessmentId,
            instituteId,
            sectionId,
        },
    });
    return response?.data;
};

export const handleGetQuestionInsightsData = ({
    assessmentId,
    instituteId,
    sectionId = '',
}: {
    assessmentId: string;
    instituteId: string | undefined;
    sectionId: string | undefined;
}) => {
    return {
        queryKey: ['GET_QUESTION_INSIGHTS_DETAILS', assessmentId, instituteId, sectionId],
        queryFn: () => getQuestionsInsightsData(assessmentId, instituteId, sectionId),
        staleTime: 60 * 60 * 1000,
        enabled: !!sectionId,
    };
};

export const getStudentLeaderboardDetails = async (
    assessmentId: string,
    instituteId: string | undefined,
    pageNo: number,
    pageSize: number,
    selectedFilter: AssessmentStudentLeaderboardInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_LEADERBOARD_URL,
        params: {
            assessmentId,
            instituteId,
            pageNo,
            pageSize,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const handleGetStudentLeaderboardExportPDF = async (
    assessmentId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_LEADERBOARD,
        params: {
            assessmentId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetStudentLeaderboardExportCSV = async (
    assessmentId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_EXPORT_CSV_URL_LEADERBOARD,
        params: {
            assessmentId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetStudentRankMarkExportCSV = async (
    assessmentId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_EXPORT_CSV_URL_RANK_MARK,
        params: {
            assessmentId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetStudentRankMarkExportPDF = async (
    assessmentId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_RANK_MARK,
        params: {
            assessmentId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetStudentQuestionInsightsExportPDF = async (
    assessmentId: string,
    instituteId: string | undefined,
    sectionIds: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_QUESTION_INSIGHTS,
        params: {
            assessmentId,
            instituteId,
            sectionIds,
        },
    });
    return response?.data;
};

export const handleGetStudentReportExportPDF = async (
    assessmentId: string,
    instituteId: string | undefined,
    attemptId: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_STUDENT_REPORT,
        params: {
            assessmentId,
            attemptId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleGetRespondentExportPDF = async (
    instituteId: string | undefined,
    sectionId: string,
    questionId: string,
    assessmentId: string,
    selectedFilter: SelectedFilterQuestionWise
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_RESPONDENT_LIST,
        params: {
            instituteId,
            sectionId,
            questionId,
            assessmentId,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const handleGetRespondentExportCSV = async (
    instituteId: string | undefined,
    sectionId: string,
    questionId: string,
    assessmentId: string,
    selectedFilter: SelectedFilterQuestionWise
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_EXPORT_CSV_URL_RESPONDENT_LIST,
        params: {
            instituteId,
            sectionId,
            questionId,
            assessmentId,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const handleGetSubmissionsExportPDF = async (
    instituteId: string | undefined,
    assessmentId: string,
    selectedFilter: SelectedSubmissionsFilterInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        responseType: 'blob',
        headers: {
            Accept: 'application/pdf',
        },
        url: GET_EXPORT_PDF_URL_SUBMISSIONS_LIST,
        params: {
            instituteId,
            assessmentId,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const handleGetSubmissionsExportCSV = async (
    instituteId: string | undefined,
    assessmentId: string,
    selectedFilter: SelectedSubmissionsFilterInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_EXPORT_CSV_URL_SUBMISSIONS_LIST,
        params: {
            instituteId,
            assessmentId,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const handleGetOverviewData = ({
    assessmentId,
    instituteId,
}: {
    assessmentId: string;
    instituteId: string | undefined;
}) => {
    return {
        queryKey: ['GET_ASSESSMENT_DETAILS', assessmentId, instituteId],
        queryFn: () => getOverviewDetials(assessmentId, instituteId),
        staleTime: 60 * 60 * 1000,
    };
};

export const getAssessmentTotalMarks = async (assessmentId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_ASSESSMENT_TOTAL_MARKS_URL,
        params: {
            assessmentId,
        },
    });
    return response?.data;
};

export const handleGetAssessmentTotalMarksData = ({ assessmentId }: { assessmentId: string }) => {
    return {
        queryKey: ['GET_ASSESSMENT_TOTAL_MARKS', assessmentId],
        queryFn: () => getAssessmentTotalMarks(assessmentId),
        staleTime: 60 * 60 * 1000,
    };
};

export const handleGetLeaderboardData = ({
    assessmentId,
    instituteId,
    pageNo,
    pageSize,
    selectedFilter,
}: {
    assessmentId: string;
    instituteId: string | undefined;
    pageNo: number;
    pageSize: number;
    selectedFilter: AssessmentStudentLeaderboardInterface;
}) => {
    return {
        queryKey: [
            'GET_STUDENT_LEADERBOARD_DETAILS',
            assessmentId,
            instituteId,
            pageNo,
            pageSize,
            selectedFilter,
        ],
        queryFn: () =>
            getStudentLeaderboardDetails(
                assessmentId,
                instituteId,
                pageNo,
                pageSize,
                selectedFilter
            ),
        staleTime: 60 * 60 * 1000,
    };
};

export const getAdminParticipants = async (
    assessmentId: string,
    instituteId: string | undefined,
    pageNo: number,
    pageSize: number,
    selectedFilter: SelectedSubmissionsFilterInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_ADMIN_PARTICIPANTS,
        params: {
            instituteId,
            assessmentId,
            pageNo,
            pageSize,
        },
        data: {
            ...selectedFilter,
            batches: selectedFilter.batches.map((batch: { id: string }) => batch.id),
        },
    });
    return response?.data;
};

export const handleAdminParticipantsData = ({
    assessmentId,
    instituteId,
    pageNo,
    pageSize,
    selectedFilter,
}: {
    assessmentId: string;
    instituteId: string | undefined;
    pageNo: number;
    pageSize: number;
    selectedFilter: SelectedSubmissionsFilterInterface;
}) => {
    return {
        queryKey: [
            'GET_ADMIN_PARTICIPANTS_DETAILS',
            assessmentId,
            instituteId,
            pageNo,
            pageSize,
            selectedFilter,
        ],
        queryFn: () =>
            getAdminParticipants(assessmentId, instituteId, pageNo, pageSize, selectedFilter),
        staleTime: 60 * 60 * 1000,
    };
};

export const getStudentReport = async (
    studentId: string | undefined,
    instituteId: string | undefined,
    pageNo: number,
    pageSize: number,
    selectedFilter: StudentReportFilterInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: STUDENT_REPORT_URL,
        params: {
            studentId,
            instituteId,
            pageNo,
            pageSize,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const viewStudentReport = async (
    assessmentId: string,
    attemptId: string,
    instituteId: string | undefined
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: STUDENT_REPORT_DETAIL_URL,
        params: {
            assessmentId,
            attemptId,
            instituteId,
        },
    });
    return response?.data;
};

export const handleStudentReportData = ({
    studentId,
    instituteId,
    pageNo,
    pageSize,
    selectedFilter,
}: {
    studentId: string | undefined;
    instituteId: string | undefined;
    pageNo: number;
    pageSize: number;
    selectedFilter: StudentReportFilterInterface;
}) => {
    return {
        queryKey: [
            'GET_STUDENT_REPORT_DETAILS',
            studentId,
            instituteId,
            pageNo,
            pageSize,
            selectedFilter,
        ],
        queryFn: () => getStudentReport(studentId, instituteId, pageNo, pageSize, selectedFilter),
        staleTime: 60 * 60 * 1000,
    };
};

export const getParticipantsListQuestionwise = async (
    assessmentId: string,
    sectionId: string | undefined,
    questionId: string | undefined,
    pageNo: number,
    pageSize: number,
    selectedFilter: SelectedFilterQuestionWise
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_PARTICIPANTS_QUESTION_WISE,
        params: {
            assessmentId,
            sectionId,
            questionId,
            pageNo,
            pageSize,
        },
        data: {
            ...selectedFilter,
            registration_source_id: selectedFilter.registration_source_id.map(
                (batch: { id: string; name: string }) => batch.id
            ),
        },
    });
    return response?.data;
};

export const handleParticipantsListQuestionwise = ({
    assessmentId,
    sectionId,
    questionId,
    pageNo,
    pageSize,
    selectedFilter,
}: {
    assessmentId: string;
    sectionId: string | undefined;
    questionId: string | undefined;
    pageNo: number;
    pageSize: number;
    selectedFilter: SelectedFilterQuestionWise;
}) => {
    return {
        queryKey: [
            'GET_PARTICIPANTS_LIST_QUESTION_WISE',
            assessmentId,
            sectionId,
            questionId,
            pageNo,
            pageSize,
            selectedFilter,
        ],
        queryFn: () =>
            getParticipantsListQuestionwise(
                assessmentId,
                sectionId,
                questionId,
                pageNo,
                pageSize,
                selectedFilter
            ),
        staleTime: 60 * 60 * 1000,
    };
};

export const getRevaluateStudentResult = async (
    assessmentId: string,
    instituteId: string | undefined,
    methodType: string,
    selectedFilter: SelectedFilterRevaluateInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_REVALUATE_STUDENT_RESULT,
        params: {
            assessmentId,
            instituteId,
            methodType,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const getReleaseStudentResult = async (
    assessmentId: string,
    instituteId: string | undefined,
    methodType: string,
    selectedFilter: SelectedReleaseResultFilterInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_RELEASE_STUDENT_RESULT,
        params: {
            assessmentId,
            instituteId,
            methodType,
        },
        data: selectedFilter,
    });
    return response?.data;
};

export const getBatchDetailsListOfStudents = async (
    pageNo: number,
    pageSize: number,
    selectedFilter: AssessmentParticipantsInterface
) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_BATCH_DETAILS_URL,
        params: {
            pageNo,
            pageSize,
        },
        data: {
            ...selectedFilter,
            gender: selectedFilter.gender.map((type: { id: string; name: string }) => type.name),
        },
    });
    return response?.data;
};

export const getBatchDetailsListOfIndividualStudents = async (
    instituteId: string | undefined,
    assessmentId: string
) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INDIVIDUAL_STUDENT_DETAILS_URL,
        params: {
            instituteId,
            assessmentId,
        },
    });
    return response?.data;
};

export const handleGetIndividualStudentList = ({
    instituteId,
    assessmentId,
}: {
    instituteId: string | undefined;
    assessmentId: string;
}) => {
    return {
        queryKey: ['GET_INDIVIDUAL_STUDENT_DETAILS', instituteId, assessmentId],
        queryFn: () => getBatchDetailsListOfIndividualStudents(instituteId, assessmentId),
        staleTime: 60 * 60 * 1000,
        enabled: assessmentId !== 'defaultId' ? true : false,
    };
};

export const getAttemptData = async (attemptId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${GET_ATTEMPT_DATA}`,
        params: {
            attemptId,
        },
    });
    return response?.data;
};

export const getAttemptDetails = (attemptId: string) => {
    return {
        queryKey: ['GET_ASSESSMENT_DETAILS', attemptId],
        queryFn: () => getAttemptData(attemptId),
        staleTime: 60 * 60 * 1000,
        enabled: !!attemptId,
    };
};

export const handleUpdateAttempt = async (attemptId: string, fileId: string) => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_ATTEMPT,
        params: {
            attemptId,
            fileId,
        },
    });
    return response?.data;
};
