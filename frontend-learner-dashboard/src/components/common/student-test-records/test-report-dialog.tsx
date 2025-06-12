"use client";

import { DotOutline, Export } from "@phosphor-icons/react";
import { MyButton } from "@/components/design-system/button";
import { Separator } from "@radix-ui/react-separator";
import {
  convertToLocalDateTime,
  extractDateTime,
  formatDuration,
  getSubjectNameById,
} from "@/constants/helper";
import {
  renderCorrectAnswer,
  renderStudentResponse,
  ResponseBreakdownComponent,
} from "./response-breakdown-component";
import { MarksBreakdownComponent } from "./marks-breakdown-component";
import { Crown } from "@/svgs";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaretLeft, Clock } from "phosphor-react";
import { parseHtmlToString } from "@/lib/utils";
import { Preferences } from "@capacitor/preferences";
import { useRouter } from "@tanstack/react-router";
import type {
  ParsedHistoryState,
  Report,
  Section,
  TestReportDialogProps,
} from "@/types/assessments/assessment-data-type";
import {
  EXPORT_ASSESSMENT_REPORT,
  GET_ASSESSMENT_MARKS,
} from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { MarksStatusIndicator } from "./marks-chip";
type TestMarks = {
  total_achievable_marks: number;
  section_wise_achievable_marks: Record<string, number>;
};
export const TestReportDialog = ({
  testReport,
  examType,
  assessmentDetails,
}: TestReportDialogProps) => {
  const report = useRouter();
  const [instituteDetails, setInstituteDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setNavHeading } = useNavHeadingStore();

  // const { state } = report.__store.state.location.state as ParsedHistoryState;
  // const studentReport: Report = state?.report || {};
  const locationState = report.__store.state.location
    .state as ParsedHistoryState;
  const defaultReport: Report = {
    assessment_id: "",
    attempt_id: "",
    assessment_name: "",
    assessment_status: "",
    subject_id: "",
    start_time: "",
    end_time: "",
    total_marks: 0,
    duration_in_seconds: 0,
    sections: {},
    attempt_date: "",
    play_mode: "",
  };

  const studentReport: Report = locationState?.report || defaultReport;
  const [testMarks, setTestMarks] = useState<TestMarks | null>(null);
  useEffect(() => {
    const fetchTestMarks = async () => {
      const assessmentId = studentReport.assessment_id;
      try {
        const response = await authenticatedAxiosInstance({
          method: "GET",
          url: GET_ASSESSMENT_MARKS,
          params: {
            assessmentId,
          },
        });
        console.log("testMarks", response);
        const data = response?.data;
        setTestMarks(data);
      } catch (error) {
        console.error("Error fetching test marks:", error);
      }
    };

    fetchTestMarks();
  }, []);

  const handleBackClick = () => {
    report.navigate({
      to: `/assessment/reports`,
    });
  };

  const heading = (
    <div className="flex items-center gap-2">
      <CaretLeft onClick={handleBackClick} className="cursor-pointer size-5" />
      <div>Report</div>
    </div>
  );

  useEffect(() => {
    setNavHeading(heading);
  }, []);

  useEffect(() => {
    const fetchInstituteDetails = async () => {
      const response = await Preferences.get({ key: "InstituteDetails" });
      console.log("response InstituteDetails", response);
      setInstituteDetails(response?.value ? JSON.parse(response.value) : null);
    };

    fetchInstituteDetails();
  }, []);
  const sectionsInfo = assessmentDetails[1]?.saved_data.sections?.map(
    (section: Section) => ({
      name: section.name,
      id: section.id,
    })
  );

  const handleExport = async () => {
    const assessmentId = studentReport.assessment_id;
    const attemptId = studentReport.attempt_id;
    const instituteId = instituteDetails.id;

    setIsLoading(true);

    try {
      const response = await authenticatedAxiosInstance({
        method: "GET",
        url: EXPORT_ASSESSMENT_REPORT,
        params: {
          assessmentId: assessmentId,
          attemptId: attemptId,
          instituteId: instituteId,
        },
        responseType: "blob",
      });

      // Create a new Blob object using the response data
      const blob = new Blob([response.data], { type: "application/pdf" });

      // Create a link element
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob); // Create a URL for the blob
      link.download = "assessment_report.pdf"; // Set the file name

      // Append to the body (required for Firefox)
      document.body.appendChild(link);

      // Programmatically click the link to trigger the download
      link.click();

      // Clean up and remove the link
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedSection, setSelectedSection] = useState(
    sectionsInfo?.length ? sectionsInfo[0]?.id : undefined
  );

  console.log("testReport", testReport, "selectedSection", selectedSection);
  const currentSectionAllQuestions = testReport?.all_sections[selectedSection!];
  console.log("currentSectionAllQuestions", currentSectionAllQuestions);

  if (testReport === null || studentReport === null || examType === undefined) {
    return;
  }
  const responseData = {
    attempted:
      testReport.question_overall_detail_dto.correctAttempt +
      testReport.question_overall_detail_dto.partialCorrectAttempt +
      testReport.question_overall_detail_dto.wrongAttempt,
    skipped: testReport.question_overall_detail_dto.skippedCount,
  };
  const marksData = {
    correct: testReport.question_overall_detail_dto.correctAttempt,
    partiallyCorrect:
      testReport.question_overall_detail_dto.partialCorrectAttempt,
    wrongResponse: testReport.question_overall_detail_dto.wrongAttempt,
    skipped: testReport.question_overall_detail_dto.skippedCount,
  };
  return (
    <>
      <div className="">
        {/* Test Info Section */}

        <div className="flex flex-col gap-10 p-2">
          <div className="flex justify-between">
            <div className="flex flex-col gap-4">
              <div className="text-h2 font-semibold">
                {studentReport.assessment_name}
              </div>
            </div>
            <div className="hidden md:block lg:block">
              <MyButton
                buttonType="secondary"
                scale="large"
                layoutVariant="default"
                onClick={!isLoading ? handleExport : undefined}
              >
                <Export />
                {isLoading ? (
                  <span className="ml-2">Exporting...</span>
                ) : (
                  <>Export</>
                )}
              </MyButton>
            </div>
          </div>

          <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 text-body">
            <div>
              Subject:{" "}
              {getSubjectNameById(
                instituteDetails?.subjects || [],
                studentReport?.subject_id
              ) || ""}
            </div>
            <div>
              Attempt Date:{" "}
              {
                extractDateTime(
                  convertToLocalDateTime(studentReport.start_time)
                ).date
              }
            </div>
            {/* <div>Marks: {studentReport.total_marks}</div> */}
            <div>
              Duration: {formatDuration(studentReport.duration_in_seconds)}
            </div>
            <div>
              Start Time:{" "}
              {
                extractDateTime(
                  convertToLocalDateTime(studentReport.start_time)
                ).time
              }
            </div>
            <div>
              End Time:{" "}
              {
                extractDateTime(convertToLocalDateTime(studentReport.end_time))
                  .time
              }
            </div>
          </div>
        </div>

        <Separator />

        {/* Charts Section */}
        <div className="p-6 text-h3 font-semibold text-primary-500">
          Score Report
        </div>
        <div className="flex flex-col md:flex-col lg:flex-row items-center gap-10 lg:gap-20 p-6">
          <div className=" flex sm:flex-row lg:flex-col items-center gap-20 p-6">
            <div className="flex flex-col">
              <h1>Rank</h1>
              <div className="flex items-center gap-1">
                {testReport.question_overall_detail_dto.rank === 1 && (
                  // <Crown className="size-6" />
                  <Crown />
                )}
                <p className="text-neutral-500">
                  {testReport.question_overall_detail_dto.rank}
                </p>
              </div>
            </div>
            <div>
              <h1>Percentile</h1>
              <p className="text-center text-neutral-500">
                {testReport.question_overall_detail_dto.percentile}%
              </p>
            </div>
            <div>
              <h1>Marks</h1>
              {/* <p className="text-neutral-500">{studentReport.total_marks}/{testMarks.total_achievable_marks}</p> */}
              <p className="text-neutral-500">
                {studentReport.total_marks}/
                {testMarks?.total_achievable_marks ?? "-"}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col items-center">
            <div className="text-h3 font-semibold">Response Breakdown</div>
            <ResponseBreakdownComponent responseData={responseData} />
            <div className="flex flex-col pt-8 ">
              <div className="-mt-14 flex items-center">
                <DotOutline
                  weight="fill"
                  className="size-20 text-success-400"
                />
                <p className="-ml-4 text-[14px]">
                  Attempted: &nbsp;{responseData.attempted}
                </p>
              </div>
              <div className="-mt-12 flex items-center">
                <DotOutline
                  weight="fill"
                  className="size-20 text-neutral-200"
                />
                <p className="-ml-4 text-[14px]">
                  Skipped: &nbsp;{responseData.skipped}
                </p>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-center">
            <div className="text-h3 font-semibold">Marks Breakdown</div>
            <MarksBreakdownComponent marksData={marksData} />
            {/* <div className="flex flex-col gap-3 ">
              <div className="-mb-8 flex items-center justify-between">
                <div className="flex items-center">
                  <DotOutline
                    size={70}
                    weight="fill"
                    className="text-success-400"
                  />
                  <p>Correct Respondents: </p>
                </div>
                <div className="flex items-center gap-2">
                  <p>{marksData.correct}</p>
                  <p>
                    {testReport.question_overall_detail_dto.totalCorrectMarks >
                    0
                      ? `(+${testReport.question_overall_detail_dto.totalCorrectMarks})`
                      : `(${testReport.question_overall_detail_dto.totalCorrectMarks})`}
                  </p>
                </div>
              </div>
              <div className="-mb-8 flex items-center justify-between gap-4">
                <div className="flex items-center">
                  <DotOutline
                    size={70}
                    weight="fill"
                    className="text-warning-400"
                  />
                  <p>Partially Correct Respondents: </p>
                </div>
                <div className="flex items-center gap-2">
                  <p>{marksData.partiallyCorrect}</p>
                  <p>
                    {testReport.question_overall_detail_dto.totalPartialMarks >
                    0
                      ? `(+${testReport.question_overall_detail_dto.totalPartialMarks})`
                      : `(${testReport.question_overall_detail_dto.totalPartialMarks})`}
                  </p>
                </div>
              </div>
              <div className="-mb-8 flex items-center justify-between">
                <div className="flex items-center">
                  <DotOutline
                    size={70}
                    weight="fill"
                    className="text-danger-400"
                  />
                  <p>Wrong Respondents: </p>
                </div>
                <div className="flex items-center gap-2">
                  <p>{marksData.wrongResponse}</p>
                  <p>
                    {testReport.question_overall_detail_dto
                      .totalIncorrectMarks > 0
                      ? `(+${testReport.question_overall_detail_dto.totalIncorrectMarks})`
                      : `(${testReport.question_overall_detail_dto.totalIncorrectMarks})`}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DotOutline
                    size={70}
                    weight="fill"
                    className="text-neutral-200"
                  />
                  <p>Skipped: </p>
                </div>
                <div className="flex items-center gap-2">
                  <p>{marksData.skipped}</p>
                  <p>(0)</p>
                </div>
              </div>
            </div> */}
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <DotOutline
                    size={35}
                    weight="fill"
                    className="text-success-400 flex-shrink-0"
                  />
                  <p className="text-sm md:text-base">Correct Respondents:</p>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm md:text-base">{marksData.correct}</p>
                  <p className="text-sm md:text-base">
                    {testReport.question_overall_detail_dto.totalCorrectMarks >
                    0
                      ? `(+${testReport.question_overall_detail_dto.totalCorrectMarks})`
                      : `(${testReport.question_overall_detail_dto.totalCorrectMarks})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <DotOutline
                    size={35}
                    weight="fill"
                    className="text-warning-400 flex-shrink-0"
                  />
                  <p className="text-sm md:text-base">
                    Partially Correct Respondents:
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm md:text-base">
                    {marksData.partiallyCorrect}
                  </p>
                  <p className="text-sm md:text-base">
                    {testReport.question_overall_detail_dto.totalPartialMarks >
                    0
                      ? `(+${testReport.question_overall_detail_dto.totalPartialMarks})`
                      : `(${testReport.question_overall_detail_dto.totalPartialMarks})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <DotOutline
                    size={35}
                    weight="fill"
                    className="text-danger-400 flex-shrink-0"
                  />
                  <p className="text-sm md:text-base">Wrong Respondents:</p>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm md:text-base">
                    {marksData.wrongResponse}
                  </p>
                  <p className="text-sm md:text-base">
                    {testReport.question_overall_detail_dto
                      .totalIncorrectMarks > 0
                      ? `(+${testReport.question_overall_detail_dto.totalIncorrectMarks})`
                      : `(${testReport.question_overall_detail_dto.totalIncorrectMarks})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DotOutline
                    size={35}
                    weight="fill"
                    className="text-neutral-200 flex-shrink-0"
                  />
                  <p className="text-sm md:text-base">Skipped:</p>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-sm md:text-base">{marksData.skipped}</p>
                  <p className="text-sm md:text-base">(0)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <Tabs
          value={selectedSection}
          onValueChange={setSelectedSection}
          className=""
        >
          <div className="sticky top-0 flex items-center justify-between overflow-auto">
            <TabsList className="mb-2 mt-6 inline-flex h-auto justify-start gap-4 rounded-none border-b !bg-transparent p-0">
              {sectionsInfo?.map((section) => (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className={`flex gap-1.5 rounded-none px-12 py-2 !shadow-none ${
                    selectedSection === section.id
                      ? "rounded-t-sm border !border-b-0 border-primary-200 !bg-primary-50"
                      : "border-none bg-transparent"
                  }`}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <span
                    className={`${selectedSection === section.id ? "text-primary-500" : ""}`}
                  >
                    {section.name}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Answer Review Section */}
        <div className="flex w-full flex-col gap-10 p-2">
          <div className="flex justify-between">
            <div className="text-h3 font-semibold text-primary-500">
              Answer Review
            </div>
            {/* Section Marks Display */}
            <div className="text-primary-500">
              Section Total Marks:{" "}
              {
                testMarks?.section_wise_achievable_marks?.[
                  selectedSection ?? "0"
                ]
              }
            </div>
          </div>
          <div className="flex w-full flex-col gap-10 pb-10 md:pb-0">
            {currentSectionAllQuestions &&
            currentSectionAllQuestions.length > 0 ? (
              currentSectionAllQuestions.map((review, index) => {
                // Import the renderer functions
                // const { renderStudentResponse, renderCorrectAnswer } = require("./question-response-renderer")

                return (
                  <div className="flex w-full flex-col gap-10" key={index}>
                    <div className="flex w-full flex-col gap-4">
                      <div className="flex w-full items-start justify-between gap-6 text-subtitle">
                        <div className="md:flex-row w-full items-start gap-6 text-title">
                          <div className="flex justify-between w-full">
                            <div className="">
                              Question ({index + 1}.)
                              <span className="ml-2 text-xs text-neutral-500">
                                {review.question_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={20} />
                              <p className="text-primary-500">
                                {review.time_taken_in_seconds} sec
                              </p>
                            </div>
                          </div>
                          <div>{parseHtmlToString(review.question_name)}</div>
                        </div>
                      </div>
                      <div className="flex w-full items-start gap-6 text-subtitle">
                        <div className="min-w-[120px]">Your response:</div>
                        <div className="flex w-full items-start justify-between">
                          <div
                            className={`flex w-full rounded-lg p-4 ${
                              review.answer_status == "CORRECT"
                                ? "bg-success-50"
                                : review.answer_status == "INCORRECT"
                                  ? "bg-danger-100"
                                  : "bg-neutral-50"
                            }`}
                          >
                            {renderStudentResponse(review)}
                          </div>
                        </div>
                      </div>
                      <div className="">
                        <MarksStatusIndicator
                          mark={review.mark}
                          answer_status={
                            review.answer_status as
                              | "CORRECT"
                              | "INCORRECT"
                              | "PARTIAL_CORRECT"
                              | "DEFAULT"
                            // | "PENDING"
                          }
                        />
                      </div>
                      {review.answer_status !== "CORRECT" && (
                        <div className="flex w-full items-start gap-6 text-subtitle">
                          <div className="min-w-[120px]">Correct answer:</div>
                          <div className="flex w-full items-start justify-between">
                            <div
                              className={`flex w-full rounded-lg bg-success-50 p-4`}
                            >
                              {renderCorrectAnswer(review)}
                            </div>
                          </div>
                        </div>
                      )}
                      {review.explanation ? (
                        <div className="flex items-start gap-6 text-subtitle">
                          <div className="min-w-[120px]">Explanation:</div>
                          <div>{parseHtmlToString(review.explanation)}</div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-6 text-subtitle">
                          <div className="min-w-[120px]">Explanation:</div>
                          <div>No explanation given</div>
                        </div>
                      )}
                    </div>
                    <Separator />
                  </div>
                );
              })
            ) : (
              <div className="py-4 text-center text-subtitle">
                No answer review available
              </div>
            )}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-md md:hidden lg:hidden">
          <div className="flex justify-center">
            <MyButton
              buttonType="secondary"
              scale="large"
              layoutVariant="default"
              onClick={!isLoading ? handleExport : undefined}
            >
              <Export />
              {isLoading ? (
                <span className="ml-2">Exporting...</span>
              ) : (
                <>Export</>
              )}
            </MyButton>
          </div>
        </div>
      </div>
    </>
  );
};
