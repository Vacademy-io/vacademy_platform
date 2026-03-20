export type MessageRole = "user" | "assistant" | "tool_call" | "tool_result" | "quiz" | "quiz_feedback";

export interface ChatbotContext {
  route: string;
  courseId?: string;
  packageSessionId?: string;
  subjectId?: string;
  moduleId?: string;
  chapterId?: string;
  slideId?: string;
  sessionId?: string;
}

export interface QuizQuestion {
  id: string;
  question: string; // Markdown format
  options: string[]; // Markdown format
}

export interface QuizData {
  quiz_id: string;
  title: string;
  topic: string;
  total_questions: number;
  time_limit_seconds?: number;
  questions: QuizQuestion[];
}

export interface QuestionFeedback {
  question_id: string;
  question_text: string;
  correct: boolean;
  user_answer_index?: number;
  correct_answer_index: number;
  user_answer_text?: string;
  correct_answer_text: string;
  explanation?: string;
}

export interface QuizFeedbackData {
  quiz_id: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  overall_feedback: string;
  recommendations: string[];
  time_taken_seconds?: number;
  question_feedback: QuestionFeedback[];
}

export interface QuizSubmission {
  quiz_id: string;
  answers: Record<string, number>; // question_id -> selected_option_index
  time_taken_seconds?: number;
}

export interface Attachment {
  type: 'image' | 'video';
  url: string;
  mime_type?: string;
  name?: string;
}

export interface ChatMessage {
  id: number;
  role: MessageRole;
  content: string;
  timestamp: number;
  context?: ChatbotContext;
  status?: 'sent' | 'pending' | 'failed';
  attachments?: Attachment[];
  metadata?: {
    tool_name?: string;
    tool_arguments?: object;
    tool_call_id?: string;
    quiz_data?: QuizData;
    feedback?: QuizFeedbackData;
  };
}

export interface ChatResponse {
  message: string;
}
