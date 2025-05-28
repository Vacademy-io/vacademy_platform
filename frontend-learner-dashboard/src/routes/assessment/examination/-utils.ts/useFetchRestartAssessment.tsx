import { Storage } from '@capacitor/storage';
import { useAssessmentStore } from "@/stores/assessment-store";
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { RESTART_ASSESSMENT } from '@/constants/urls';

interface StoredData {
  assessment?: {
    attempt_id: string;
    assessment_id: string;
    preview_total_time?: number;
    section_dtos?: SectionDTO[];
  };
  entireTestTimer?: number;
  tabSwitchCount?: number;
  sectionTimers?: Record<string, { timeLeft: number }>;
  questionTimers?: Record<string, number>;
  questionTimeSpent?: Record<string, number>;
  questionStates?: Record<string, { isMarkedForReview: boolean; isVisited: boolean }>;
  answers?: Record<string, string[]>;
}

interface SectionDTO {
  id: string;
  duration?: number;
  question_preview_dto_list?: QuestionDTO[];
}

interface QuestionDTO {
  question_id: string;
  question_type: string;
}

interface FormattedData {
  attemptId: string;
  clientLastSync: string;
  assessment: {
    assessmentId: string;
    entireTestDurationLeftInSeconds: number;
    timeElapsedInSeconds: number;
    status: string;
    tabSwitchCount: number;
  };
  sections: Section[];
}

interface Section {
  sectionId: string;
  sectionDurationLeftInSeconds: number;
  timeElapsedInSeconds: number;
  questions: Question[];
}

interface Question {
  questionId: string;
  questionDurationLeftInSeconds: number;
  timeTakenInSeconds: number;
  isMarkedForReview: boolean;
  isVisited: boolean;
  responseData: {
    type: string;
    optionIds: string[];
  };
}

const formatStoredAssessmentData = (storedData: StoredData): FormattedData | null => {
  if (!storedData || !storedData.assessment) {
    console.error("Invalid stored assessment data.");
    return null;
  }

  return {
    attemptId: storedData.assessment?.attempt_id,
    clientLastSync: new Date().toISOString(),
    assessment: {
      assessmentId: storedData.assessment?.assessment_id,
      entireTestDurationLeftInSeconds: storedData.entireTestTimer || 0,
      timeElapsedInSeconds: storedData.assessment?.preview_total_time
        ? storedData.assessment.preview_total_time * 60 - (storedData.entireTestTimer || 0)
        : 0,
      status: "LIVE",
      tabSwitchCount: storedData.tabSwitchCount || 0,
    },
    sections: storedData.assessment?.section_dtos?.map((section) => ({
      sectionId: section.id,
      sectionDurationLeftInSeconds: storedData.sectionTimers?.[section.id]?.timeLeft || 0,
      timeElapsedInSeconds: section.duration
        ? section.duration * 60 - (storedData.sectionTimers?.[section.id]?.timeLeft || 0)
        : 0,
      questions: section.question_preview_dto_list?.map((question) => ({
        questionId: question.question_id,
        questionDurationLeftInSeconds:
          storedData.questionTimers?.[question.question_id] || 0,
        timeTakenInSeconds: storedData.questionTimeSpent?.[question.question_id] || 0,
        isMarkedForReview:
          storedData.questionStates?.[question.question_id]?.isMarkedForReview || false,
        isVisited:
          storedData.questionStates?.[question.question_id]?.isVisited || false,
        responseData: {
          type: question.question_type,
          optionIds: storedData.answers?.[question.question_id] || [],
        },
      })) || [],
    })) || [],
  };
};

interface RestartAssessmentResponse {
  preview_response: any;
  learner_assessment_attempt_data_dto: FormattedData;
  update_status_response: any;
  start_assessment_response: any;
}

export async function restartAssessment(assessmentId: string, attemptId: string): Promise<boolean> { 
  console.log('Restarting assessment:', { assessmentId, attemptId });
  const storedAssessmentData = await Storage.get({ key: `ASSESSMENT_STATE_${attemptId}` });

  console.log('Stored Assessment Data:', storedAssessmentData);
  const body = storedAssessmentData.value ? formatStoredAssessmentData(JSON.parse(storedAssessmentData.value)) : {};
  console.log('Restarting assessment with body:', body);
  try {
    // API Call
    const restartApiResponse = await authenticatedAxiosInstance.post<RestartAssessmentResponse>(
      `${RESTART_ASSESSMENT}`,
      body, //api body
      { params: { assessmentId, attemptId } }
    );

    console.log('Restart API Response:', restartApiResponse);

    // Ensure we get the correct data
    const { data } = restartApiResponse;
    if (!data) throw new Error("Empty API response");

    const { preview_response, learner_assessment_attempt_data_dto, update_status_response, start_assessment_response } = data;
    // if (!preview_response || !learner_assessment_attempt_data_dto || !update_status_response) {
    //   console.error("Missing API data:", { preview_response, learner_assessment_attempt_data_dto, update_status_response });
    //   return false;
    // }

    // Store data properly
    await Storage.set({ key: 'Assessment_questions', value: JSON.stringify(preview_response) });
    console.log('Stored Assessment Data:', await Storage.get({ key: 'Assessment_questions' }));
    
    await Storage.set({ key: 'server_start_end_time', value: JSON.stringify(start_assessment_response) });
    console.log('Stored server_start_end_time:', await Storage.get({ key: 'server_start_end_time' }));
    
    console.log('preview_response.attemptId', preview_response, preview_response.attempt_id);
    storeFormattedData(learner_assessment_attempt_data_dto, preview_response);

    await Storage.set({ key: 'Announcements', value: JSON.stringify(update_status_response) });
    console.log('Stored Announcements:', await Storage.get({ key: 'Announcements' }));

    console.log('Assessment restart completed successfully');
    return true;
  } catch (error) {
    console.error('Error restarting assessment:', error);
    return false;
  }
}
  



export const storeFormattedData = async (formattedData: any, preview_response : any) => {
    const state = useAssessmentStore.getState();
    const attemptId = preview_response.attempt_id;
    console.log("formattedData",formattedData,"preview_response",preview_response, "attemptId", attemptId);
  console.log(attemptId);
    if (!attemptId) {
      console.error("Attempt ID is missing in formatted data");
      return;
    }
  
    state.setAssessment(preview_response);
    useAssessmentStore.setState({
      assessment: preview_response,
      currentSection: 0, 
      currentQuestion: preview_response.section_dtos[0].question_preview_dto_list[0], 
      questionStates: Object.fromEntries(
        formattedData.sections.flatMap((section: Section) =>
          section.questions.map((question: Question) => [
            question.questionId,
            {
              isAnswered: question.responseData.optionIds.length > 0,
              isVisited: question.isVisited,
              isMarkedForReview: question.isMarkedForReview,
              isDisabled: false, // Assuming default value
            },
          ])
        )
      ),
      answers: Object.fromEntries(
        formattedData.sections.flatMap((section: Section) =>
          section.questions.map((question: Question) => [
            question.questionId,
            question.responseData.optionIds || [],
          ])
        )
      ),
      sectionTimers: Object.fromEntries(
        formattedData.sections.map((section: Section) => [
          section.sectionId,
          { timeLeft: section.sectionDurationLeftInSeconds },
        ])
      ),
      questionTimers: Object.fromEntries(
        formattedData.sections.flatMap((section: Section) =>
          section.questions.map((question: Question) => [
            question.questionId,
            question.questionDurationLeftInSeconds,
          ])
        )
      ),
      questionTimeSpent: Object.fromEntries(
        formattedData.sections.flatMap((section: Section) =>
          section.questions.map((question: Question) => [
            question.questionId,
            question.timeTakenInSeconds,
          ])
        )
      ),
      entireTestTimer: formattedData.assessment.entireTestDurationLeftInSeconds,
      tabSwitchCount: formattedData.assessment.tabSwitchCount,
      questionStartTime: {}, // Needs separate handling
    });
  
    // Save state to storage
    await useAssessmentStore.getState().saveState();
  };