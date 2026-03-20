"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HelpModal } from "@/components/modals/help-modals";
import { useAssessmentStore } from "@/stores/assessment-store";
import { SubmitModal } from "@/components/modals/submit-modal";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, Upload, FileText } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { TimesUpModal } from "@/components/modals/times-up-modal";
import { ASSESSMENT_SUBMIT, ASSESSMENT_SUBMIT_MANUAL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";
import { Storage } from "@capacitor/storage";
import { useProctoring } from "@/hooks";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
// import { formatDataFromStore } from "./page";
import { useFileUpload } from "@/hooks/use-file-upload";
// import { PdfViewerComponent } from "@/components/pdf-viewer"
import type {
  DocumentLoadEvent,
  PageChangeEvent,
} from "@react-pdf-viewer/core";
import { PdfViewerComponent } from "../study-library/level-material/subject-material/module-material/chapter-material/slide-material/pdf-viewer-component";
import { getServerStartEndTime } from "./page";

export function Navbar({
  playMode,
  evaluationType,
}: {
  playMode: string;
  evaluationType: string;
}) {
  const {
    assessment,
    submitAssessment,
    updateEntireTestTimer,
    tabSwitchCount,
    incrementTabSwitchCount,
    entireTestTimer,
    setEntireTestTimer,
    resetAssessment,
    setPdfFile,
    pdfFile,
  } = useAssessmentStore();

  const navigate = useNavigate();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTimesUpModal, setShowTimesUpModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);

  const { uploadFile, getPublicUrl } = useFileUpload();

  const [INSTITUTE_ID, setInstituteId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [pdfDocumentInfo, setPdfDocumentInfo] = useState({
    numPages: 0,
    currentPage: 0,
  });

  const formatDataFromStore = async (
    assessment_id: string,
    status: string,
    evaluationType: string,
    fileId: string
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

    const base = {
      attemptId,
      ...(evaluationType === "MANUAL" && {
        fileId: fileId,
        setId: "ggcgc",
      }),
      clientLastSync,
      assessment: {
        assessmentId: assessment_id,
        entireTestDurationLeftInSeconds: state.entireTestTimer,
        timeElapsedInSeconds,
        status,
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

          const baseQuestionData = {
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
          };

          if (evaluationType !== "MANUAL") {
            return {
              ...baseQuestionData,
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
          } else {
            return baseQuestionData;
          }
        }),
      })),
    };

    return base;
  };

  useEffect(() => {
    const fetchInstituteAndUserId = async () => {
      const instituteResult = await Preferences.get({ key: "InstituteId" });
      setInstituteId(instituteResult.value || null);

      const userResult = await Preferences.get({ key: "StudentDetails" });
      const userDetails = userResult.value
        ? JSON.parse(userResult.value)
        : null;
      setUserId(userDetails?.user_id || null);
    };

    fetchInstituteAndUserId();
  }, []);

  interface HelpType {
    type: "instructions" | "alerts" | "reattempt" | "time" | null;
  }
  const { fullScreen } = useProctoring({
    forceFullScreen: true,
    preventTabSwitch: true,
    preventContextMenu: true,
    preventUserSelection: true,
    preventCopy: true,
  });

  const [helpType, setHelpType] = useState<HelpType["type"]>(null);

  const sendFormattedData = async () => {
    const state = useAssessmentStore.getState();
    const InstructionID_and_AboutID = await Preferences.get({
      key: "InstructionID_and_AboutID",
    });

    const assessment_id_json = InstructionID_and_AboutID.value
      ? JSON.parse(InstructionID_and_AboutID.value)
      : null;
    const formattedData = await formatDataFromStore(
      assessment_id_json?.assessment_id,
      "END",
      evaluationType ?? "",
      pdfFile?.fileId ?? ""
    );
    console.log("evaluationType", evaluationType, "pdfFile", pdfFile);
    if (evaluationType === "MANUAL" && pdfFile) {
      console.log("Submitting manual assessment with PDF file:", pdfFile);
      const response = await authenticatedAxiosInstance.post(
        `${ASSESSMENT_SUBMIT_MANUAL}`,
        {
          json_content: JSON.stringify(formattedData),
          set_id: pdfFile.fileId,
        },
        {
          params: {
            attemptId: state.assessment?.attempt_id,
            assessmentId: assessment_id_json?.assessment_id,
            instituteId: INSTITUTE_ID,
          },
        }
      );
      console.log("response of manual", response);
      if (response?.data) {
        const { value } = await Storage.get({ key: "Assessment_questions" });

        if (value) {
          try {
            const parsedData = JSON.parse(value);
            const attemptId = parsedData?.attempt_id;

            if (attemptId) {
              const storageKey = `ASSESSMENT_STATE_${attemptId}`;
              await Storage.remove({ key: storageKey });
            } else {
              console.error("Attempt ID not found in Assessment_questions.");
            }
          } catch (error) {
            console.error("Error parsing Assessment_questions:", error);
          }
        } else {
          console.error("No data found in Assessment_questions.");
        }
      }

      return response?.data;
    } else if (evaluationType === "AUTO") {
      const response = await authenticatedAxiosInstance.post(
        `${ASSESSMENT_SUBMIT}`,
        { json_content: JSON.stringify(formattedData) },
        {
          params: {
            attemptId: state.assessment?.attempt_id,
            assessmentId: assessment_id_json?.assessment_id,
          },
        }
      );

      if (response?.data) {
        const { value } = await Storage.get({ key: "Assessment_questions" });

        if (value) {
          try {
            const parsedData = JSON.parse(value);
            const attemptId = parsedData?.attempt_id;

            if (attemptId) {
              const storageKey = `ASSESSMENT_STATE_${attemptId}`;
              await Storage.remove({ key: storageKey });
            } else {
              console.error("Attempt ID not found in Assessment_questions.");
            }
          } catch (error) {
            console.error("Error parsing Assessment_questions:", error);
          }
        } else {
          console.error("No data found in Assessment_questions.");
        }
      }

      return response?.data;
    }
  };

  useEffect(() => {
    if (evaluationType !== "MANUAL" && tabSwitchCount >= 3) {
      setShowSubmitModal(true);
      handleSubmit();
    }
  }, [tabSwitchCount, evaluationType]);

  useEffect(() => {
    let backButtonListener: PluginListenerHandle | null = null;

    const setupBackButtonListener = async () => {
      backButtonListener = await App.addListener("backButton", () => {
        setShowSubmitModal(true);
        return false;
      });
    };

    setupBackButtonListener();

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        incrementTabSwitchCount();
        setShowWarningModal(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const updateEntireTimeLeft = () => {
      const { entireTestTimer } = useAssessmentStore.getState();
      setEntireTestTimer(entireTestTimer);
    };

    updateEntireTimeLeft();
    const timer = setInterval(() => {
      updateEntireTestTimer();
      updateEntireTimeLeft();
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (timeInSeconds: number) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    const padNumber = (num: number) => num.toString().padStart(2, "0");

    return `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)}`;
  };

  if (!assessment) return null;

  // const isAllTimeUp = entireTestTimer === 0;

  const handleSubmit = async () => {
    let attemptCount = 0;
    const state = useAssessmentStore.getState();
    const attemptId = state.assessment?.attempt_id;

    if (!attemptId) {
      console.error("Attempt ID is missing. Cannot proceed with submission.");
      toast.error("Submission failed: Attempt ID is missing.");
      return;
    }

    const submitData = async () => {
      const success = await sendFormattedData();
      console.log("Success:", success);
      if (!success && attemptCount < 5) {
        attemptCount++;
        const retryInterval = 10000 + attemptCount * 5000; // 10, 15, 20, 25, 30 seconds

        setTimeout(submitData, retryInterval);
        toast.error("Failed to submit assessment. Retrying...");
      } else if (success) {
        submitAssessment();
        toast.success("Assessment submitted successfully!");

        resetAssessment();

        navigate({
          to: "/assessment/examination",
          replace: true,
        });

        setTimeout(async () => {
          const { value } = await Storage.get({ key: "Assessment_questions" });

          if (value) {
            try {
              const parsedData = JSON.parse(value);
              const attemptId = parsedData?.attempt_id;

              if (attemptId) {
                const storageKey = `ASSESSMENT_STATE_${attemptId}`;

                // Remove from Capacitor Storage
                await Storage.remove({ key: storageKey });
                console.log(`${storageKey} removed from Capacitor Storage`);
              } else {
                console.error("Attempt ID not found in Assessment_questions.");
              }
            } catch (error) {
              console.error("Error parsing Assessment_questions:", error);
            }
          }
        }, 2000);
      }
    };

    submitData();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const handleDocumentLoad = (e: DocumentLoadEvent) => {
    setPdfDocumentInfo((prev) => ({
      ...prev,
      numPages: e.doc.numPages,
    }));
    console.log("pdfDocumentInfo", pdfDocumentInfo);
  };

  const handlePageChange = (e: PageChangeEvent) => {
    setPdfDocumentInfo((prev) => ({
      ...prev,
      currentPage: e.currentPage,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileId = await uploadFile({
        file,
        setIsUploading,
        userId: userId ?? "",
        source: INSTITUTE_ID ?? undefined,
        sourceId: "EVALUATIONS",
      });

      if (fileId) {
        const publicUrl = await getPublicUrl(fileId);
        console.log("Public URL:", publicUrl);
        console.log("File ID:", fileId);
        setPdfFile({
          fileId,
          fileName: file.name,
          fileUrl: publicUrl,
          size: file.size,
          file: file,
        });
      }
    } catch (error) {
      console.error("PDF Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreviewPdf = () => {
    if (pdfFile) {
      setShowPdfPreview(true);
    }
  };

  // useEffect(()=>{

  //   if (isAllTimeUp && !showTimesUpModal) {
  //     setShowTimesUpModal(true);
  //   }
  // }, []);

  return (
    <>
      <div className="sticky top-0 z-50 flex bg-primary-50 h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setHelpType("instructions")}>
                Instructions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHelpType("alerts")}>
                Assessment Alerts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHelpType("reattempt")}>
                Request Reattempt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHelpType("time")}>
                Request Time Increase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="">
          {entireTestTimer && (
            <div className="flex items-center gap-2 text-lg  justify-center">
              <div className="flex items-center space-x-4">
                {playMode !== "PRACTICE" &&
                  playMode !== "SURVEY" &&
                  entireTestTimer && (
                    <div className="flex items-center gap-2 text-lg justify-center">
                      <div className="flex items-center space-x-4">
                        {formatTime(entireTestTimer)
                          .split(":")
                          .map((time, index, array) => (
                            <div
                              key={index}
                              className="relative flex items-center"
                            >
                              <span className="border border-gray-400 px-2 py-1 rounded">
                                {time}
                              </span>
                              {index < array.length - 1 && (
                                <span className="absolute right-[-10px] text-lg">
                                  :
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {evaluationType === "MANUAL" ? (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />

              {pdfFile ? (
                <div className="flex items-center gap-2">
                  <MyButton
                    scale="medium"
                    buttonType="secondary"
                    layoutVariant="default"
                    onClick={handlePreviewPdf}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Preview PDF
                  </MyButton>
                </div>
              ) : (
                <MyButton
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <span className="loader h-4 w-4"></span>
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploading ? "Uploading..." : "Upload PDF"}
                </MyButton>
              )}
            </>
          ) : (
            <MyButton
              type="submit"
              scale="medium"
              buttonType="primary"
              layoutVariant="default"
              onClick={() => setShowSubmitModal(true)}
            >
              Submit
            </MyButton>
          )}
        </div>
      </div>

      {showPdfPreview && pdfFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              {/* <h2 className="text-lg font-semibold">
                PDF Preview: {pdfFile.fileName} {pdfDocumentInfo.currentPage + 1}/{pdfDocumentInfo.numPages}
              </h2> */}
              <Button variant="ghost" onClick={() => setShowPdfPreview(false)}>
                <span className="sr-only">Back</span>← Back
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <PdfViewerComponent
                pdfUrl={pdfFile.fileUrl}
                handleDocumentLoad={handleDocumentLoad}
                handlePageChange={handlePageChange}
              />
            </div>
            <div className="flex justify-between p-4 border-t">
              <MyButton
                // variant="outline"
                buttonType="secondary"
                onClick={() => {
                  setShowPdfPreview(false);
                  fileInputRef.current?.click();
                }}
              >
                Replace PDF
              </MyButton>
              <MyButton
                buttonType="primary"
                onClick={() => {
                  setShowPdfPreview(false);
                  setShowSubmitModal(true);
                }}
              >
                Submit
              </MyButton>
            </div>
          </div>
        </div>
      ) : null}

      <SubmitModal
        open={showSubmitModal}
        onOpenChange={setShowSubmitModal}
        onConfirm={handleSubmit}
      />

      <TimesUpModal
        open={showTimesUpModal}
        onOpenChange={setShowTimesUpModal}
        onFinish={handleSubmit}
      />
      {evaluationType !== "MANUAL" ? (
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
                  setShowWarningModal(false);
                }, 100);
              }}
            >
              Return to Test
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <HelpModal
        open={helpType !== null}
        onOpenChange={(open) => !open && setHelpType(null)}
        type={helpType || "instructions"}
      />
    </>
  );
}
