/**
 * Live AI Tutor — learner-side REST (ai_service /tutor/v1). The socket lives in
 * hooks/useTutorSocket.ts.
 */
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { AI_SERVICE_URL } from "@/constants/urls";

const BASE = `${AI_SERVICE_URL}/tutor/v1`;

export interface TutorAvailability {
  enabled: boolean;
  default_on: boolean;
  teacher_name: string;
  course_language: "en" | "hi";
  languages: string[];
  session_language: "course" | "learner";
  tts_provider: string;
  ready_slides: number;
  teachable_slides: number;
  available: boolean;
  resume_slide_id?: string | null;
  first_slide_id?: string | null;
  resume_chapter_id?: string | null;
  first_chapter_id?: string | null;
}

export interface TutorChapterSlide {
  slide_id: string;
  title: string | null;
  source_type: string;
  order: number | null;
  teachable: boolean;
  plan_id: string | null;
}

export interface TutorStartResponse {
  tutor_session_id: string;
  slide_id: string;
  language: "en" | "hi";
  resumed: boolean;
  teacher_name: string;
  learner_name: string | null;
  topics: Array<{ id: string; title: string; concepts: number }>;
  progress: { done: number; total: number; percent: number };
  socket_path: string;
}

export const getTutorAvailability = async (
  packageId: string,
  packageSessionId?: string,
): Promise<TutorAvailability> => {
  const res = await authenticatedAxiosInstance.get<TutorAvailability>(
    `${BASE}/learner/packages/${packageId}/availability`,
    { params: packageSessionId ? { package_session_id: packageSessionId } : undefined },
  );
  return res.data;
};

export const getTutorChapterSlides = async (
  chapterId: string,
  packageSessionId: string,
): Promise<TutorChapterSlide[]> => {
  const res = await authenticatedAxiosInstance.get<{ slides: TutorChapterSlide[] }>(
    `${BASE}/learner/chapters/${chapterId}/slides`,
    { params: { package_session_id: packageSessionId } },
  );
  return res.data.slides;
};

export const startTutorSession = async (params: {
  packageSessionId: string;
  slideId?: string;
  mode: "TEXT" | "VOICE";
  language?: "en" | "hi";
}): Promise<TutorStartResponse> => {
  const res = await authenticatedAxiosInstance.post<TutorStartResponse>(`${BASE}/sessions`, {
    package_session_id: params.packageSessionId,
    slide_id: params.slideId,
    mode: params.mode,
    language: params.language,
  });
  return res.data;
};

export const endTutorSession = async (tutorSessionId: string): Promise<void> => {
  try {
    await authenticatedAxiosInstance.post(`${BASE}/sessions/${tutorSessionId}/end`);
  } catch {
    /* the socket usually ends it first */
  }
};
