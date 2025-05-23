"use client";

import { useEffect, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useRouter } from "@tanstack/react-router";
import { ArrowUpDown, ExternalLink, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GET_PUBLIC_URL } from "@/constants/urls";
import { SectionWiseAnsExtracted, Student } from "../-utils/utils";
import StatusIndicator from "./status-indicator";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { MyDialog } from "@/components/design-system/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import axios from "axios";
import { MyButton } from "@/components/design-system/button";

// Default token for authorization
const DEFAULT_ACCESS_TOKEN =
    "eyJhbGciOiJIUzI1NiJ9.eyJmdWxsbmFtZSI6IkRvZSBXYWxrZXIiLCJ1c2VyIjoiOTE3YjI1YWMtZjZhZi00ZjM5LTkwZGYtYmQxZDIxZTQyNTkzIiwiZW1haWwiOiJkb2VAZXhhbXBsZS5jb20iLCJpc19yb290X3VzZXIiOmZhbHNlLCJhdXRob3JpdGllcyI6eyI5ZDNmNGNjYi1hN2Y2LTQyM2YtYmM0Zi03NWM2ZDYxNzYzNDYiOnsicGVybWlzc2lvbnMiOltdLCJyb2xlcyI6WyJTVFVERU5UIl19fSwidXNlcm5hbWUiOiJkb2V3NjA2OSIsInN1YiI6ImRvZXc2MDY5IiwiaWF0IjoxNzQ1MzI2ODI2LCJleHAiOjE3NDU5MzE2MjZ9._O0T3Q0kxXLE9JnwC79IQCpwl-sAdFqR8nHa3MTpE5U";

// Helper function to get public URL
const getPublicUrl = async (fileId: string | undefined | null): Promise<string> => {
    const response = await axios.get(GET_PUBLIC_URL, {
        params: { fileId, expiryDays: 1 },
        headers: {
            Authorization: `Bearer ${DEFAULT_ACCESS_TOKEN}`,
        },
    });
    return response?.data;
};

interface EnrolledStudent {
    name: string;
    enrollId: string;
    pdfId: string;
    fileId?: string;
}

export default function StudentEvaluationTable({
    data,
    isProcessing,
}: {
    data: Student[];
    isProcessing?: boolean;
}) {
    const router = useRouter();
    const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
    const [loadingPdf, setLoadingPdf] = useState<Record<string, boolean>>({});
    const [openPreview, setOpenPreview] = useState(false);
    const [extracted, setExtracted] = useState<SectionWiseAnsExtracted[]>([]);
    const [openConfirmRevaluate, setOpenConfirmRevaluate] = useState(false);
    const [previewStudent, setPreviewStudent] = useState<string | null>(null);

    // Load enrolled students from localStorage
    useEffect(() => {
        const savedStudents = JSON.parse(localStorage.getItem("students") || "[]");
        setEnrolledStudents(savedStudents);
    }, []);

    // Find fileId by matching enrollmentId with enrollId
    const findFileIdByEnrollmentId = (enrollmentId: string): string | undefined => {
        const matchedStudent = enrolledStudents.find(
            (student) => student.enrollId === enrollmentId,
        );
        return matchedStudent?.fileId;
    };

    // Handle preview PDF
    const handlePreviewPdf = async (enrollmentId: string) => {
        const fileId = findFileIdByEnrollmentId(enrollmentId);

        if (!fileId) {
            toast.error("No PDF submission found for this student");
            return;
        }

        try {
            setLoadingPdf((prev) => ({ ...prev, [enrollmentId]: true }));
            const url = await getPublicUrl(fileId);

            if (url) {
                // Open in new tab
                window.open(url, "_blank");
            } else {
                toast.error("Could not retrieve PDF URL");
            }
        } catch (error) {
            console.error("Error fetching PDF URL:", error);
            toast.error("Failed to retrieve PDF");
        } finally {
            setLoadingPdf((prev) => ({ ...prev, [enrollmentId]: false }));
        }
    };

    return (
        <div className="container mx-auto py-6">
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader className="bg-[#f9f7f0]">
                        <TableRow>
                            <TableHead>Id</TableHead>
                            <TableHead>
                                <div className="flex items-center gap-1">
                                    Name
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead>Submission</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead className="w-24">Details</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((student) => {
                            const fileId = findFileIdByEnrollmentId(student.enrollmentId);
                            const hasSubmission = !!fileId;

                            return (
                                <TableRow key={student.name} className="hover:bg-muted/30">
                                    <TableCell>{student.id}</TableCell>
                                    <TableCell>{student.name}</TableCell>

                                    <TableCell>
                                        {loadingPdf[student.enrollmentId] ? (
                                            <div className="flex items-center gap-1 text-orange-500">
                                                <Loader2 className="size-3.5 animate-spin" />
                                                <span>Loading...</span>
                                            </div>
                                        ) : hasSubmission ? (
                                            <div
                                                className="flex cursor-pointer items-center gap-1 text-orange-500 hover:underline"
                                                onClick={() =>
                                                    handlePreviewPdf(student.enrollmentId)
                                                }
                                            >
                                                <FileText className="size-3.5" />
                                                <span>Preview</span>
                                            </div>
                                        ) : (
                                            //TODO: revert this to no submission handling after demo
                                            <span className="cursor-pointer text-primary-500 hover:underline">
                                                Preview
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isNullOrEmptyOrUndefined(student.marks) ? (
                                            <RowLoader />
                                        ) : (
                                            student.marks
                                        )}
                                    </TableCell>
                                    <TableCell className="">
                                        {student.status === "EVALUATION_COMPLETED" &&
                                        !isProcessing ? (
                                            <div
                                                onClick={() => {
                                                    router.navigate({
                                                        to: `/evaluator-ai/evaluation/student-summary?studentId=${student.id}`,
                                                    });
                                                }}
                                            >
                                                <span className="cursor-pointer text-orange-500 hover:underline">
                                                    Details
                                                </span>
                                            </div>
                                        ) : (
                                            <RowLoader />
                                        )}
                                    </TableCell>
                                    <TableCell className="flex items-center gap-x-2">
                                        <StatusIndicator status={student.status} />
                                        {student.status === "EVALUATING" &&
                                            !isNullOrEmptyOrUndefined(student.extracted) && (
                                                <ExternalLink
                                                    className="cursor-pointer"
                                                    onClick={() => {
                                                        setOpenPreview(true);
                                                        setExtracted(student.extracted);
                                                        setPreviewStudent(student.name);
                                                    }}
                                                />
                                            )}
                                        {/* {student.status === "EVALUATION_COMPLETED" && (
                                            <RefreshCcwDot
                                                onClick={() => {
                                                    setOpenConfirmRevaluate(true);
                                                    setRevaluateStudent({
                                                        assessmentId: student.assessmentId,
                                                        responseId: student.responseId,
                                                        name: student.name,
                                                        id: student.id,
                                                    });
                                                }}
                                                className="cursor-pointer"
                                            />
                                        )} */}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <MyDialog
                    open={openPreview}
                    onOpenChange={() => {
                        setOpenPreview(false);
                        setExtracted([]);
                    }}
                    heading={`Extracted Responses of ${previewStudent}`}
                    dialogWidth="w-[600px]"
                >
                    <div className="mt-4">
                        <Accordion type="single" collapsible className="w-full">
                            {extracted[0]?.question_wise_ans_extracted
                                .sort((a, b) => a.question_order - b.question_order)
                                .map((question) => (
                                    <AccordionItem
                                        key={question.question_id}
                                        value={question.question_id}
                                    >
                                        <AccordionTrigger className="rounded-md px-4 py-3 hover:bg-gray-50">
                                            <div className="flex w-full items-center justify-between pr-4">
                                                <div className="flex text-left font-medium">
                                                    <span className="mr-2 text-gray-500">
                                                        {question.question_order}.
                                                    </span>
                                                    <div
                                                        className="prose prose-sm max-w-none"
                                                        dangerouslySetInnerHTML={{
                                                            __html:
                                                                question.question_text.replace(
                                                                    /^\[\[(.*)\]\]$/s,
                                                                    "$1",
                                                                ) ?? "",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="mb-2 mt-1 rounded-md bg-gray-50 px-4 py-3">
                                            <div
                                                dangerouslySetInnerHTML={{
                                                    __html:
                                                        question.answer_html?.replace(
                                                            /^\[\[(.*)\]\]$/s,
                                                            "$1",
                                                        ) ?? "",
                                                }}
                                            />
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                        </Accordion>
                    </div>
                </MyDialog>
                <MyDialog
                    open={openConfirmRevaluate}
                    onOpenChange={() => setOpenConfirmRevaluate(false)}
                    heading="Confirm Re-evaluation"
                    dialogWidth="w-[400px]"
                >
                    <div className="mt-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to re-evaluate this student?
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <MyButton
                            onClick={() => {
                                setOpenConfirmRevaluate(false);
                            }}
                        >
                            Go ahead
                        </MyButton>
                    </div>
                </MyDialog>
            </div>
        </div>
    );
}

const RowLoader = () => {
    return (
        <div className="relative flex items-center justify-center">
            <Loader2 className="absolute size-4 animate-spin text-primary-500" />
        </div>
    );
};
