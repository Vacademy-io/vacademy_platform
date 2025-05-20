"use client";

import { useState, useEffect } from "react";
import { useAssessmentStore } from "@/stores/assessment-store";
import { MyButton } from "@/components/design-system/button";
import { useRouter } from "@tanstack/react-router";
import { startAssessment } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";
import { Storage } from "@capacitor/storage";
import { AssessmentPreviewData } from "@/types/assessment";
import { processHtmlString } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useProctoring } from "@/hooks";
import { App } from "@capacitor/app";
import { useLocation } from "@tanstack/react-router";
import { PluginListenerHandle } from "@capacitor/core";

export function AssessmentPreview() {
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  const newPath = currentPath.replace(/\/[^/]+$/, "/LearnerLiveTest");
  const { assessment } = useAssessmentStore();
  const { setAssessment, incrementTabSwitchCount, tabSwitchCount } =
    useAssessmentStore();
  const [activeSection, setActiveSection] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => {
    return (
      (assessment?.preview_total_time ? assessment.preview_total_time : 0) * 60
    );
  });
  const [showWarningModal, setShowWarningModal] = useState(false);
  const { fullScreen } = useProctoring({
    forceFullScreen: true,
    preventTabSwitch: true,
    preventContextMenu: true,
    preventUserSelection: true,
    preventCopy: true,
  });

  const location = useLocation();
  const [backButtonListener, setBackButtonListener] =
    useState<PluginListenerHandle | null>(null);

  useEffect(() => {
    const setupBackButtonListener = async () => {
      if (location.pathname === "/restricted-page") {
        const listener = await App.addListener("backButton", () => {
          console.log("Back button is disabled on this page");
        });
        setBackButtonListener(listener);
      }
    };

    setupBackButtonListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [location.pathname]);

  const calculateMarkingScheme = (marking_json: string) => {
    try {
      const marking_scheme = JSON.parse(marking_json);
      return marking_scheme; // Ensure the JSON contains a number or string
    } catch (error) {
      console.error("Error parsing marking_json:", error);
      return 0; // Default value in case of an error
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const handleStartAssessment = async () => {
    // resetAssessment();
    await startAssessment();
    router.navigate({ to: newPath, replace: true });
  };

  useEffect(() => {
    const setAssessmentData = async () => {
      try {
        const { value } = await Storage.get({ key: "Assessment_questions" });

        if (!value) {
          console.warn("No assessment data found in storage.");
          return;
        }

        const parsedData: AssessmentPreviewData = JSON.parse(value);
        setAssessment(parsedData);
      } catch (error) {
        console.error("Error parsing assessment data:", error);
      }
    };

    setAssessmentData();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleStartAssessment();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        incrementTabSwitchCount();
        setShowWarningModal(true);
      } else {
        setShowWarningModal(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [incrementTabSwitchCount]);

  const handleWarningClose = () => {
    setShowWarningModal(false);
    // if (tabSwitchCount >= 3) {
    //   handleSubmit();
    // }
  };

  if (!assessment) return null;

  return (
    <>
      <div className="flex flex-col w-full bg-gray-50">
        {/* Navbar with Timer */}
        <div className="sticky top-0 z-20 bg-white border-b">
          <div className="flex bg-primary-50 items-center justify-center sm:flex-row  p-4">
            <h1 className="text-base ml-5 font-semibold">Preview</h1>
            {/* <h1 className="text-base font-semibold">
            {assessmentData ? assessmentData.name : "Loading..."}
          </h1> */}
            <div className="flex items-center justify-center space-x-4 mr-14 w-full">
              {formatTime(timeLeft)
                .split(":")
                .map((time, index, array) => (
                  <div key={index} className="relative flex items-center">
                    <span className="border border-gray-400 px-2 py-1 rounded">
                      {time}
                    </span>
                    {index < array.length - 1 && (
                      <span className="absolute right-[-10px] text-lg">:</span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Section Tabs */}
          <div className="sticky top-0 z-10 bg-white border-b">
            <div className="flex overflow-x-auto items-center justify-between p-4 pb-0">
              <div className="flex flex-nowrap items-center space-x-4">
                {assessment.section_dtos?.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(index)}
                    className={`px-4 py-2 text-sm rounded-t-lg ${
                      activeSection === index
                        ? "bg-orange-50 text-primary-500 border border-b-0 border-primary-500"
                        : "text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-max">
                      <span>{section.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-6">
          <div className="flex flex-col space-y-8">
            {assessment.section_dtos[
              activeSection
            ].question_preview_dto_list.map((question, idx) => (
              <div
                key={question.question_id}
                className="bg-white rounded-lg p-4 sm:p-6 shadow-sm"
              >
                <div className="flex flex-row gap-2 mb-4">
                  <span className="text-sm text-gray-500">
                    Question {idx + 1}
                  </span>
                  <span className="text-sm text-gray-500 ml-auto">
                    {
                      calculateMarkingScheme(question.marking_json).data
                        .totalMark
                    }{" "}
                    Marks
                  </span>
                </div>

                <p className="text-base mb-4">
                  {/* {question.question.content} */}
                  {processHtmlString(question.question.content).map(
                    (item, index) =>
                      item.type === "text" ? (
                        <span key={index}>{item.content}</span>
                      ) : (
                        <img
                          key={index}
                          src={item.content}
                          alt={`Question image ${index + 1}`}
                          className=""
                        />
                      )
                  )}
                </p>

                <div className="space-y-3">
                  {question.options.map((option) => (
                    <div
                      key={option.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      {/* {parseHtmlToString(option.text.content)} */}
                      {processHtmlString(option.text.content).map(
                        (item, index) =>
                          item.type === "text" ? (
                            <span key={index}>{item.content}</span>
                          ) : (
                            <img
                              key={index}
                              src={item.content}
                              alt={`Question image ${index + 1}`}
                              className=""
                            />
                          )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bg-primary-50 bottom-0 p-4 bg-white border-t">
          <div className="flex  justify-center">
            <MyButton
              onClick={() => handleStartAssessment()}
              buttonType="primary"
              scale="large"
              layoutVariant="default"
            >
              Start Test
            </MyButton>
          </div>
        </div>
      </div>

      <AlertDialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <AlertDialogContent>
          <AlertDialogDescription>
            Warning: You are attempting to leave the test environment. This is
            warning {tabSwitchCount} of 3. If you attempt to leave again, your
            test will be automatically submitted.
          </AlertDialogDescription>
          <AlertDialogAction
            onClick={() => {
              fullScreen.trigger();
              setTimeout(() => {
                handleWarningClose();
              }, 100);
            }}
          >
            Return to Test
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
