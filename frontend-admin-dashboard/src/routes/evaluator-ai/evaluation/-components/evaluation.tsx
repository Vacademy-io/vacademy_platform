/* eslint-disable */
// @ts-nocheck
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { StudentSelectionDialog } from "./select-students";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { UserX } from "lucide-react";
import StudentEvaluationTable from "./student-evaulation";
import { toast } from "sonner";
import { useLoaderStore } from "../-hooks/loader";
import { type StudentData } from "./select-students";
import { EVALUATION_TOOL_EVALUATE_ASSESSMENT, EVALUATION_TOOL_STATUS } from "@/constants/urls";
import { parseEvaluationResults, transformEvaluationData } from "../-utils/utils";
import axios from "axios";
import { MyButton } from "@/components/design-system/button";
import { FileMagnifyingGlass } from "@phosphor-icons/react";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

interface OutputData {
    id: string;
    response_id: string;
    full_name: string;
    email: string;
    contact_number: string;
}

interface TaskResponse {
    task_id: string;
    response: string;
    status: string;
}

interface EvaluatedStudent {
    id: string;
    name: string;
    score: number;
    status: "pending" | "processing" | "completed" | "failed";
    // Add other student properties as needed
}

const ShimmerLoadingTable = ({
    isPolling,
    loadingText = "",
}: {
    isPolling: boolean;
    loadingText?: string;
}) => {
    return (
        <div className="flex w-full flex-col gap-4">
            <div className="text-base font-bold">
                {" "}
                {!isPolling ? "Please wait we are Evaluating students..." : loadingText}
            </div>
            <div className="w-full overflow-x-auto">
                <table className="min-w-full rounded-md border border-muted">
                    <thead>
                        <tr className="bg-muted/30">
                            <th className="p-3 text-left">
                                <div className="shimmer h-4 w-24 animate-pulse rounded bg-muted"></div>
                            </th>
                            <th className="p-3 text-left">
                                <div className="shimmer h-4 w-32 animate-pulse rounded bg-muted"></div>
                            </th>
                            <th className="p-3 text-left">
                                <div className="shimmer h-4 w-20 animate-pulse rounded bg-muted"></div>
                            </th>
                            <th className="p-3 text-left">
                                <div className="shimmer h-4 w-16 animate-pulse rounded bg-muted"></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((row) => (
                            <tr key={row} className="border-t border-muted">
                                <td className="p-4">
                                    <div className="shimmer h-4 w-28 animate-pulse rounded bg-muted"></div>
                                </td>
                                <td className="p-4">
                                    <div className="shimmer h-4 w-36 animate-pulse rounded bg-muted"></div>
                                </td>
                                <td className="p-4">
                                    <div className="shimmer h-4 w-20 animate-pulse rounded bg-muted"></div>
                                </td>
                                <td className="p-4">
                                    <div className="shimmer h-8 w-16 animate-pulse rounded bg-muted"></div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const EvaluatedStudents = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [evaluatedData, setEvaluatedData] = useState<EvaluatedStudent[]>(() => {
        const storedData = localStorage.getItem("evaluatedStudentData");
        return storedData ? JSON.parse(storedData) : [];
    });
    const [partialResults, setPartialResults] = useState<EvaluatedStudent[]>([]);
    const [isPolling, setIsPolling] = useState(false);
    const [hasInitialData, setHasInitialData] = useState(false);
    const [assessmentName, setAssessmentName] = useState<string | null>(null);

    const { isLoading, setLoading } = useLoaderStore();

    function transformStudentData(studentDataArray: StudentData[]): OutputData[] {
        return studentDataArray.map((student) => {
            const attemptIndex = student.currentAttemptIndex;
            return {
                id: student.id,
                response_id: student.attempts[attemptIndex]?.pdfId,
                full_name: student.name,
                email: student.email ?? "",
                contact_number: student.contact_number ?? "",
            };
        });
    }

    const handleStudentSubmit = async (students: StudentData[], selectedAssessment: string) => {
        try {
            setLoading(true);
            setIsPolling(true);
            setHasInitialData(false);
            setPartialResults([]);
            const data = transformStudentData(students);
            const name = getAssessmentName(selectedAssessment);
            setAssessmentName(name);
            // First API call to start evaluation
            const evaluateResponse = await axios<TaskResponse>({
                method: "POST",
                url: EVALUATION_TOOL_EVALUATE_ASSESSMENT,
                data: data,
                params: {
                    assessmentId: selectedAssessment,
                },
            });

            if (evaluateResponse.status !== 200) {
                throw new Error("Failed to initiate evaluation");
            }

            const taskId = evaluateResponse.data.task_id;

            // Polling function with partial results handling
            const pollStatus = async (): Promise<void> => {
                let isCompleted = false;

                while (!isCompleted) {
                    try {
                        const statusResponse = await axios<TaskResponse>({
                            method: "GET",
                            url: `${EVALUATION_TOOL_STATUS}/${taskId}`,
                            data: null,
                        });

                        // Check if we have partial results
                        if (statusResponse.data.response) {
                            try {
                                const parsedData = parseEvaluationResults(statusResponse.data);
                                const students = transformEvaluationData(
                                    parsedData,
                                    selectedAssessment,
                                );

                                console.log("students data", students);
                                // Update partial results
                                setPartialResults((prev) => {
                                    const newResults = [...prev];
                                    students.forEach((student) => {
                                        const existingIndex = newResults.findIndex(
                                            (s) => s.id === student.id,
                                        );
                                        if (existingIndex >= 0) {
                                            newResults[existingIndex] = student;
                                        } else {
                                            newResults.push(student);
                                        }
                                    });
                                    return newResults;
                                });

                                // Mark that we have initial data
                                if (students.length > 0 && !hasInitialData) {
                                    setHasInitialData(true);
                                }
                            } catch (parseError) {
                                console.error("Error parsing partial results:", parseError);
                            }
                        }

                        // Check if task is completed
                        if (
                            statusResponse.data.status === "COMPLETED" ||
                            statusResponse.data.status === "FAILED"
                        ) {
                            isCompleted = true;

                            if (statusResponse.data.status === "COMPLETED") {
                                const parsedResults = parseEvaluationResults(statusResponse.data);
                                const students = transformEvaluationData(
                                    parsedResults,
                                    selectedAssessment,
                                );
                                console.log("completed", students);
                                localStorage.setItem(
                                    "evaluatedStudentData",
                                    JSON.stringify(students),
                                );
                                setEvaluatedData(students);
                                toast.success(`Successfully evaluated ${students.length} students`);
                            } else {
                                if (statusResponse.data.response.includes("File Still Processing"))
                                    toast.error(`File is processing please try again`);
                                else toast.error(`Evaluation failed for ${selectedAssessment}`);
                            }
                        }
                    } catch (error) {
                        console.error("Polling error:", error);
                    }

                    // Wait before next poll
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            };

            // Start polling without waiting for it to finish
            pollStatus().finally(() => {
                setIsPolling(false);
                setLoading(false);
            });
        } catch (error) {
            console.error("Evaluation error:", error);
            toast.error("Failed to evaluate students");
            setIsPolling(false);
            setLoading(false);
        }
    };

    const getAssessmentName = (id: string) => {
        const storedData = localStorage.getItem("assessments") as {
            assessmentId: string;
            title: string;
        }[];
        const assessments = JSON.parse(storedData || "[]");
        if (isNullOrEmptyOrUndefined(assessments)) {
            throw new Error("Assessments not found");
        } else {
            const name = assessments.find((assessment) => assessment.assessmentId === id)?.title;
            return name;
        }
    };

    // Combine evaluated data with partial results
    const displayData = isPolling ? partialResults : evaluatedData;

    return (
        <main className="flex min-h-screen flex-col items-center">
            <div className="flex w-full justify-between gap-4">
                <h1 className="mb-8 items-center text-xl font-bold">
                    Evaluation list {assessmentName && `for ${assessmentName}`}
                </h1>

                <MyButton
                    scale="large"
                    buttonType="primary"
                    layoutVariant="default"
                    className="ml-auto"
                    onClick={() => {
                        setIsDialogOpen(true);
                    }}
                >
                    <FileMagnifyingGlass size={32} />
                    Evaluate Students
                </MyButton>
            </div>

            {/* Show table when we have data (either partial or complete) */}
            {(hasInitialData || displayData.length > 0) && (
                <div className="w-full">
                    <StudentEvaluationTable
                        data={displayData}
                        isProcessing={isPolling}
                        handleStudentSubmit={handleStudentSubmit}
                    />
                </div>
            )}

            {/* Show shimmer only when loading and no data has arrived yet */}
            {isLoading && !hasInitialData && <ShimmerLoadingTable isPolling={false} />}

            {/* Show empty state only when not loading and no data exists */}
            {!isLoading && !isPolling && displayData.length === 0 && (
                <Card className="mt-8 w-[75vw] border-2 border-dashed bg-muted/30">
                    <CardHeader className="flex flex-row items-center justify-center pb-2">
                        <UserX className="size-12 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center pb-6 text-center">
                        <CardTitle className="mb-2 mt-4 text-xl font-medium">
                            No Evaluated Students
                        </CardTitle>
                        <CardDescription className="max-w-md">
                            You haven&apos;t evaluated any students yet. Click the "Evaluate
                            Student" button to select students for evaluation.
                        </CardDescription>
                    </CardContent>
                    <CardFooter className="flex justify-center pb-6">
                        <MyButton
                            scale="large"
                            buttonType="primary"
                            layoutVariant="default"
                            className="ml-auto"
                            onClick={() => {
                                setIsDialogOpen(true);
                            }}
                        >
                            <FileMagnifyingGlass size={32} />
                            Evaluate Students
                        </MyButton>
                    </CardFooter>
                </Card>
            )}

            <StudentSelectionDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                // @ts-expect-error : //FIXME this error
                onSubmit={handleStudentSubmit}
                title="Select Students for Assignment"
            />
        </main>
    );
};
