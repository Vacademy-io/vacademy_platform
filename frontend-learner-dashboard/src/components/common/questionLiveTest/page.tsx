"use client";

import { useEffect, useState } from "react";
import { QuestionDisplay } from "./question-display";
import { SectionTabs } from "./section-tabs";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { Sidebar } from "./sidebar";
import { useAssessmentStore } from "@/stores/assessment-store";
import NetworkStatus from "./network-status";
import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { ASSESSMENT_SAVE } from "@/constants/urls";
import { toast } from "sonner";

export function convertToLocalDateTime(utcDate: string): string {
  const date = new Date(utcDate);

  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  const formattedDate = date.toLocaleString("en-GB", options);
  return formattedDate
    .replace(",", "")
    .replace(/\s(am|pm)/i, (match) => match.toUpperCase());
}

// Function to format data from assessment-store
export const getServerStartEndTime = async () => {
  const { value } = await Preferences.get({ key: "server_start_end_time" });
  return value ? JSON.parse(value) : {};
};

export const formatDataFromStore = async (
  assessment_id: string,
  status: string
) => {
  const parsedValue = await getServerStartEndTime();
  const start_time = parsedValue.start_time
    ? new Date(parsedValue.start_time).getTime()
    : 0;

  const state = useAssessmentStore.getState();
  const attemptId = state.assessment?.attempt_id;
  const timeElapsedInSeconds = state.assessment?.duration
    ? state.assessment.duration * 60 - state.entireTestTimer
    : 0;
  const clientLastSync = new Date(
    start_time + timeElapsedInSeconds * 1000
  ).toISOString();

  return {
    attemptId: attemptId,
    clientLastSync,
    assessment: {
      assessmentId: assessment_id,
      entireTestDurationLeftInSeconds: state.entireTestTimer,
      timeElapsedInSeconds,
      status: status,
      tabSwitchCount: state.tabSwitchCount || 0,
    },
    sections: state.assessment?.section_dtos?.map((section, idx) => ({
      sectionId: section.id,
      sectionDurationLeftInSeconds: state.sectionTimers?.[idx]?.timeLeft || 0,
      timeElapsedInSeconds: section.duration
        ? (state.sectionTimers?.[idx]?.timeLeft || 0) - section.duration * 60
        : 0,
      questions: section.question_preview_dto_list?.map((question) => {
        const rawAnswer = state.answers?.[question.question_id];
        const normalizedAnswer = Array.isArray(rawAnswer)
          ? rawAnswer[0]
          : rawAnswer;

        return {
          questionId: question.question_id,
          questionDurationLeftInSeconds:
            state.questionTimers?.[question.question_id] || 0,
          timeTakenInSeconds:
            state.questionTimeSpent[question.question_id] || 0,
          isMarkedForReview:
            state.questionStates[question.question_id]?.isMarkedForReview ||
            false,
          isVisited:
            state.questionStates[question.question_id]?.isVisited || false,
          responseData: {
            type: question.question_type,
            ...(question.question_type === "NUMERIC"
              ? {
                  validAnswer:
                    normalizedAnswer !== undefined &&
                    normalizedAnswer !== null &&
                    !isNaN(parseFloat(normalizedAnswer))
                      ? parseFloat(normalizedAnswer)
                      : null,
                }
              : ["ONE_WORD", "LONG_ANSWER"].includes(question.question_type)
                ? { answer: normalizedAnswer || "" }
                : { optionIds: rawAnswer || [] }),
          },
        };
      }),
    })),
  };
};

export default function Page() {
  const { loadState, saveState } = useAssessmentStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playMode, setPlayMode] = useState<string>("");
  const [evaluationType, setEvaluationType] = useState<string>("");

  const sendFormattedData = async () => {
    try {
      const state = useAssessmentStore.getState();
      const InstructionID_and_AboutID = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });

      const assessment_id_json = InstructionID_and_AboutID.value
        ? JSON.parse(InstructionID_and_AboutID.value)
        : null;
      const formattedData = await formatDataFromStore(
        assessment_id_json?.assessment_id,
        "LIVE"
      );
      const response = await authenticatedAxiosInstance.post(
        `${ASSESSMENT_SAVE}`,
        { json_content: JSON.stringify(formattedData) },
        {
          params: {
            attemptId: state.assessment?.attempt_id,
            assessmentId: assessment_id_json?.assessment_id,
          },
        }
      );

      // Save announcements in local storage
      await Preferences.set({
        key: "announcements",
        value: JSON.stringify(response.data),
      });

      return response.data;
    } catch (error) {
      console.error("Error sending data:", error);
      throw error;
    }
  };

  const { isSubmitted } = useAssessmentStore();

  useEffect(() => {
    const sendData = async () => {
      console.log("Sending data...");
      try {
        await sendFormattedData();
      } catch (error) {
        console.error("Error in periodic data sending:", error);
        // Show toast notification for failure
        toast.error("Your responses are not being recorded");
      }
    };

    const sent = async () => {
      // Check if isSubmitted is false and time is not up before sending data
      const state = useAssessmentStore.getState();

      if (!isSubmitted && state.entireTestTimer > 0) {
        await sendData();
      }
    };

    sent();

    const interval = setInterval(() => {
      sent();
    }, 60000);

    // Cleanup function to clear the interval
    return () => clearInterval(interval);
  }, [isSubmitted]);

  useEffect(() => {
    const initializeAssessment = async () => {
      await loadState();
    };

    initializeAssessment();

    const saveInterval = setInterval(() => {
      saveState();
    }, 1000);

    return () => {
      clearInterval(saveInterval);
      saveState();
    };
  }, []);
  useEffect(() => {
    const fetchPlayMode = async () => {
      const storedMode = await Preferences.get({
        key: "InstructionID_and_AboutID",
      });
      if (storedMode.value) {
        const parsedData = JSON.parse(storedMode.value);
        setPlayMode(parsedData.play_mode);
        setEvaluationType(parsedData.evaluation_type);
      }
    };

    fetchPlayMode();
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex flex-col w-full bg-gray-50">
      <Navbar playMode={playMode} evaluationType={evaluationType} />
      <SectionTabs />
      <div className="flex-1 overflow-hidden">
        <main className="w-full h-full p-4 md:p-6 overflow-auto">
          <QuestionDisplay />
        </main>
      </div>
      <Footer onToggleSidebar={toggleSidebar} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        evaluationType={evaluationType}
      />
      <NetworkStatus />
    </div>
  );
}
