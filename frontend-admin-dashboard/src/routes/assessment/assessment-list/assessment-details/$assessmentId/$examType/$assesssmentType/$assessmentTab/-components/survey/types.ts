// Survey-specific types and interfaces

export interface SurveyQuestion {
    id: string;
    text: string;
    type: SurveyQuestionType;
    required: boolean;
    options?: SurveyOption[];
    responses: SurveyResponse[];
}

export type SurveyQuestionType =
    | 'mcq_single_choice'
    | 'mcq_multiple_choice'
    | 'true_false'
    | 'short_answer'
    | 'long_answer'
    | 'numerical'
    | 'rating';

export interface SurveyOption {
    id: string;
    text: string;
    value: string;
}

export interface SurveyResponse {
    id: string;
    respondentId: string;
    questionId: string;
    answer: string | string[] | number;
    submittedAt: string;
}

export interface SurveyRespondent {
    id: string;
    name: string;
    email: string;
    completedAt: string;
    responses: SurveyResponse[];
}

export interface SurveyAnalytics {
    totalParticipants: number;
    completedResponses: number;
    completionRate: number;
    averageResponseTime: string;
    totalQuestions: number;
    averageRating?: number;
}

export interface QuestionAnalytics {
    questionId: string;
    questionText: string;
    questionType: SurveyQuestionType;
    totalResponses: number;
    responseDistribution: ResponseDistribution[];
    topInsights: string[];
}

export interface ResponseDistribution {
    value: string;
    count: number;
    percentage: number;
}

export interface SurveyInsight {
    id: string;
    title: string;
    description: string;
    type: 'positive' | 'negative' | 'neutral';
    impact: 'high' | 'medium' | 'low';
}

// API Response Types (matching backend)
export interface SurveyRespondentResponse {
  question: string;
  question_type: string;
  response: string;
  name: string;
  email: string;
}

export interface SurveyRespondentResponseData {
  content: SurveyRespondentResponse[];
  page_no: number;
  page_size: number;
  total_pages: number;
  total_elements: number;
  last: boolean;
}

export interface IndividualResponseData {
  name: string;
  email: string;
  response: string;
  attempt_id?: string;
  source_id?: string;
  source?: string;
}

export interface IndividualResponseApiData {
  content: IndividualResponseData[];
  page_no: number;
  page_size: number;
  total_pages: number;
  total_elements: number;
  last: boolean;
}

export interface RichTextContent {
  id: string;
  type: string;
  content: string;
}

export interface QuestionOption {
  id: string;
  preview_id: string;
  question_id: string;
  text: RichTextContent;
  media_id: string;
  option_order: number;
  created_on: string;
  updated_on: string;
}

export interface QuestionOptionWithExplanation extends QuestionOption {
  explanation_text: RichTextContent;
}

export interface AssessmentQuestionPreview {
  question_id: string;
  parent_rich_text: RichTextContent;
  question: RichTextContent;
  section_id: string;
  question_duration: number;
  question_order: number;
  marking_json: string;
  evaluation_json: string;
  question_type: string;
  options: QuestionOption[];
  options_with_explanation: QuestionOptionWithExplanation[];
}

export interface McqSurveyInfo {
  option: string;
  percentage: number;
  respondent_count: number;
}

export interface McqSurveyDto {
  type: string;
  total_respondent: number;
  order: number;
  mcq_survey_info_list: McqSurveyInfo[];
}

export interface OneWordLongSurveyResponse {
  name: string;
  email: string;
  answer: string;
}

export interface OneWordLongSurveyDto {
  type: string;
  total_respondent: number;
  order: number;
  latest_response: OneWordLongSurveyResponse[];
}

export interface NumberSurveyInfo {
  answer: string;
  total_responses: number;
}

export interface NumberSurveyDto {
  type: string;
  total_respondent: number;
  order: number;
  number_survey_info_list: NumberSurveyInfo[];
}

export interface SurveyQuestionData {
  assessment_question_preview_dto: AssessmentQuestionPreview;
  mcq_survey_dtos: McqSurveyDto[];
  one_word_long_survey_dtos: OneWordLongSurveyDto[];
  number_survey_dtos: NumberSurveyDto[];
}

export interface SurveyOverviewResponse {
  survey_id: string;
  total_participants: number;
  participants_responded: number;
  all_surveys: SurveyQuestionData[];
}

// Transformed data types for UI components
export interface TransformedSurveyAnalytics {
  totalParticipants: number;
  completedResponses: number;
  completionRate: number;
  averageResponseTime?: string;
  totalQuestions: number;
  averageRating?: number;
}

export interface TransformedQuestionAnalytics {
  questionId: string;
  questionText: string;
  questionType: SurveyQuestionType;
  totalResponses: number;
  responseDistribution: ResponseDistribution[];
  topInsights: string[];
}

export interface TransformedSurveyRespondent {
  id: string;
  name: string;
  email: string;
  source_id?: string;
  completedAt?: string;
  responses: SurveyResponse[];
}

// Mock data types for demonstration (kept for fallback)
export interface MockSurveyData {
    analytics: SurveyAnalytics;
    questions: QuestionAnalytics[];
    respondents: SurveyRespondent[];
    insights: SurveyInsight[];
}
