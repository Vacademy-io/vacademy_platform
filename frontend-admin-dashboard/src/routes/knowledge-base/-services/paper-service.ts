import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_SERVICE_BASE_URL, ADD_QUESTION_PAPER } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type {
    Blueprint,
    BlueprintResponse,
    BlueprintRow,
    PaperIssue,
    PaperJob,
    PaperQuestion,
    PaperSpec,
    RawPaperQuestion,
} from '../-types/paper';

const BASE = `${AI_SERVICE_BASE_URL}/knowledge-base/v1`;

/**
 * Plan a paper, or revise the current plan.
 *
 * The same call serves the first build and every chat refinement — a refinement
 * carries the blueprint currently on screen plus what to change, and the planner
 * returns the FULL updated plan so the teacher's own edits survive.
 */
export const buildBlueprint = async (
    kbId: string,
    payload: {
        spec: PaperSpec;
        selected_node_ids?: string[];
        current_blueprint?: Blueprint;
        instruction?: string;
    }
): Promise<BlueprintResponse> => {
    const { data } = await authenticatedAxiosInstance.post<BlueprintResponse>(
        `${BASE}/bases/${kbId}/paper/blueprint`,
        payload
    );
    return data;
};

export const startGeneration = async (
    kbId: string,
    payload: { blueprint: Blueprint; grade?: string }
): Promise<{ task_id: string; planned: number }> => {
    const { data } = await authenticatedAxiosInstance.post<{ task_id: string; planned: number }>(
        `${BASE}/bases/${kbId}/paper/generate`,
        payload
    );
    return data;
};

export const getPaperJob = async (taskId: string): Promise<PaperJob> => {
    const { data } = await authenticatedAxiosInstance.get<PaperJob>(`${BASE}/paper-jobs/${taskId}`);
    return data;
};

export const regenerateQuestion = async (
    kbId: string,
    payload: { blueprint_row: BlueprintRow; instruction?: string; grade?: string }
): Promise<{ question: PaperQuestion; raw_question: RawPaperQuestion }> => {
    const { data } = await authenticatedAxiosInstance.post<{
        question: PaperQuestion;
        raw_question: RawPaperQuestion;
    }>(`${BASE}/bases/${kbId}/paper/regenerate`, payload);
    return data;
};

export const validatePaper = async (
    kbId: string,
    payload: { blueprint: Blueprint; questions: RawPaperQuestion[] }
): Promise<{ issues: PaperIssue[]; error_count: number; warning_count: number }> => {
    const { data } = await authenticatedAxiosInstance.post<{
        issues: PaperIssue[];
        error_count: number;
        warning_count: number;
    }>(`${BASE}/bases/${kbId}/paper/validate`, payload);
    return data;
};

/**
 * Save to the institute's question bank.
 *
 * Posts AddQuestionPaperDTO directly rather than going through
 * `addQuestionPaper()` in assessment/question-papers/-utils. That helper takes
 * the FE's own MyQuestionPaperFormInterface and re-derives the DTO from it —
 * round-tripping through that form shape would drop the <img> markup and the
 * auto_evaluation_json the generator already produced. ai_service returns the
 * exact QuestionDTO array this endpoint expects, so it is passed through intact.
 */
export const savePaperToQuestionBank = async (payload: {
    title: string;
    questions: PaperQuestion[];
    levelId?: string;
    subjectId?: string;
}): Promise<{ id?: string } | undefined> => {
    const instituteId = getInstituteId();
    const { data } = await authenticatedAxiosInstance.post(ADD_QUESTION_PAPER, {
        title: payload.title,
        institute_id: instituteId,
        level_id: payload.levelId ?? null,
        subject_id: payload.subjectId ?? null,
        questions: payload.questions,
    });
    return data;
};
