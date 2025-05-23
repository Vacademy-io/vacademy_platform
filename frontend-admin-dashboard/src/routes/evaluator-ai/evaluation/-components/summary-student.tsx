import { Button } from '@/components/ui/button';
import { useSearch, useRouter } from '@tanstack/react-router';
import { usePDF } from 'react-to-pdf';
import useLocalStorage from '../../-hooks/useLocalStorage';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import axios from 'axios';
import { GET_PUBLIC_URL } from '@/constants/urls';
import emailjs from 'emailjs-com';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import { Loader2, Mail } from 'lucide-react';
import { UploadFileInS3Public } from '@/routes/signup/-services/signup-services';
import { toast } from 'sonner';
import { MyDialog } from '@/components/design-system/dialog';

interface ISummary {
    evaluation_result: {
        overall_description: string;
        overall_verdict: string;
        total_marks: number;
        total_marks_obtained: number;
        section_wise_results: {
            question_wise_results: {
                description: string;
                feedback: string;
                total_marks: number;
                marks_obtained: number;
                question_order: number;
                question_text: string;
                question_id: string;
            }[];
        }[];
    };
    section_wise_ans_extracted: {
        question_wise_ans_extracted: {
            answer_html: string;
            question_id: string;
            question_order: number;
            question_text: string;
            status: string;
        }[];
    }[];
    user_id: string;
    name: string;
}
interface IEvaluationData {
    assessment: string;
    enrollmentId: string;
    id: string;
    marks: string;
    name: string;
    status: string;
    summary: ISummary;
}

const DEFAULT_ACCESS_TOKEN =
    'eyJhbGciOiJIUzI1NiJ9.eyJmdWxsbmFtZSI6IkRvZSBXYWxrZXIiLCJ1c2VyIjoiOTE3YjI1YWMtZjZhZi00ZjM5LTkwZGYtYmQxZDIxZTQyNTkzIiwiZW1haWwiOiJkb2VAZXhhbXBsZS5jb20iLCJpc19yb290X3VzZXIiOmZhbHNlLCJhdXRob3JpdGllcyI6eyI5ZDNmNGNjYi1hN2Y2LTQyM2YtYmM0Zi03NWM2ZDYxNzYzNDYiOnsicGVybWlzc2lvbnMiOltdLCJyb2xlcyI6WyJTVFVERU5UIl19fSwidXNlcm5hbWUiOiJkb2V3NjA2OSIsInN1YiI6ImRvZXc2MDY5IiwiaWF0IjoxNzQ1MzI2ODI2LCJleHAiOjE3NDU5MzE2MjZ9._O0T3Q0kxXLE9JnwC79IQCpwl-sAdFqR8nHa3MTpE5U';

const reportSchema = z.object({
    email: z.string().email('Invalid email address'),
    subject: z.string().optional(),
    remarks: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

export default function EvaluationSummary() {
    const { toPDF, targetRef } = usePDF({ filename: 'report.pdf' });
    const [studentSummary, setSummaryData] = useState<IEvaluationData>();
    const [open, setOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [sendingMail, setSendlingMail] = useState(false);
    const [openPreview, setOpenPreview] = useState(false);
    const [previewText, setPreviewText] = useState({
        first: '',
        second: '',
    });

    const router = useRouter();

    const { studentId } = useSearch({ from: '/evaluator-ai/evaluation/student-summary/' }) as {
        studentId: number;
    };
    const [evaluationData] = useLocalStorage('evaluatedStudentData', []) as [IEvaluationData[]];

    useEffect(() => {
        const studentData = evaluationData.find(
            (data) => data.enrollmentId === studentId.toString()
        );
        setSummaryData(studentData);
    }, []);

    const getPublicUrl = async (fileId: string | undefined | null): Promise<string> => {
        const response = await axios.get(GET_PUBLIC_URL, {
            params: { fileId, expiryDays: 1 },
            headers: {
                Authorization: `Bearer ${DEFAULT_ACCESS_TOKEN}`,
            },
        });
        return response?.data;
    };

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ReportFormValues>({
        resolver: zodResolver(reportSchema),
    });

    const onSubmit = async (data: ReportFormValues) => {
        setOpen(false);
        if (!targetRef.current) return;

        // Generate PDF
        const canvas = await html2canvas(targetRef.current);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        console.log(width, height);
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        const blob = pdf.output('blob');

        // Convert blob to File and append to FormData
        const file = new File([blob], 'evaluation.pdf', { type: 'application/pdf' });
        const formData = new FormData();
        console.log('File to upload:', file);
        formData.append('file', file);

        // upload to s3
        const uploadedFileId = await UploadFileInS3Public(file, setIsUploading, 'REPORT');
        setIsUploading(false);
        // Upload file via axios
        try {
            setSendlingMail(true);
            if (!uploadedFileId) throw new Error('File id not found');
            const fileUrl = await getPublicUrl(uploadedFileId);
            console.log('File URL:', fileUrl);
            // Send Email via emailjs
            await emailjs.send(
                'service_7lkigf5',
                'template_iixl5pv',
                {
                    to_email: data.email,
                    subject: data.subject || 'Evaluation Report',
                    name: studentSummary?.name || 'Student',
                    message:
                        data.remarks ||
                        studentSummary?.summary.evaluation_result.overall_description,
                    buttonLink: fileUrl,
                },
                'Ui2SejB0xwurTySXJ'
            );

            console.log('Email sent with PDF link:', fileUrl);
            toast.success('Email sent successfully');
        } catch (err) {
            toast.error('Error sending mail');
            console.error('Error uploading PDF or sending email:', err);
        } finally {
            setSendlingMail(false);
        }
    };

    if (sendingMail || isUploading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="flex w-80 flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-xl">
                    <Loader2 className="size-12 animate-spin text-primary-500" />
                    <h2 className="text-lg font-semibold">
                        {isUploading && 'Generating Pdf...'}
                        {sendingMail && 'Sending Mail...'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        This might take a while, please wait.
                    </p>
                </div>
            </div>
        );
    }
    return (
        <div className="mx-auto w-[95vw] space-y-6 bg-white">
            {/* Header */}
            <div className="m-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            router.history.back();
                        }}
                    >
                        ← Back
                    </Button>
                    <h1 className="text-base font-bold text-gray-800">Evaluation Summary</h1>
                </div>
                <span className="flex items-center gap-2">
                    <Button
                        variant={'outline'}
                        onClick={() => {
                            toPDF();
                        }}
                    >
                        Export Report
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button variant={'outline'}>
                                <Mail className="size-4" />
                                Send Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Send Evaluation Report</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div>
                                    <Input
                                        type="email"
                                        placeholder="Recipient Email"
                                        {...register('email')}
                                    />
                                    {errors.email && (
                                        <p className="text-xs text-red-500">
                                            {errors.email.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Input
                                        type="text"
                                        placeholder="Subject (optional)"
                                        {...register('subject')}
                                    />
                                </div>
                                <div>
                                    <Textarea
                                        placeholder="Remarks (optional)"
                                        {...register('remarks')}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">Send</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </span>
            </div>

            {/* Student Information */}
            <div className="mx-auto space-y-6 bg-white p-5" ref={targetRef}>
                <div className="rounded-md border border-[#e6e3d8]">
                    <div className="rounded-t-md border-b border-[#e6e3d8] bg-[#faf9f5] px-4 py-2">
                        <h2 className="text-sm font-medium text-gray-700">Student Information</h2>
                    </div>
                </div>

                <div className="-mt-4 flex flex-wrap justify-between px-1 text-sm">
                    <div className="flex gap-2">
                        <span className="text-gray-600">Learner Name:</span>
                        <span>{studentSummary?.name}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-gray-600">LEARNER ID:</span>
                        <span>{studentSummary?.id}</span>
                    </div>
                </div>

                {/* Evaluation Summary */}
                <h2 className="mt-8 text-base font-bold text-gray-800">Evaluation Summary</h2>

                {/* Evaluation Details */}
                <div className="rounded-md border border-[#e6e3d8]">
                    <div className="rounded-t-md border-b border-[#e6e3d8] bg-[#faf9f5] px-4 py-2">
                        <h3 className="text-sm font-medium text-gray-700">Evaluation Details</h3>
                    </div>
                </div>

                <div className="-mt-4 space-y-4 px-1">
                    <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-gray-600">Assessment:</span>
                        <span>{studentSummary?.assessment}</span>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 text-sm">
                        <span className="w-16 text-gray-600">Summary:</span>
                        <span className="flex-1">
                            {studentSummary?.summary.evaluation_result.overall_description}
                        </span>
                    </div>
                </div>

                <div className="absolute right-14 mt-[-100px]">
                    <div className="text-xs text-gray-600">Total Marks:</div>
                    <div className="text-center text-2xl font-bold text-orange-500">
                        {studentSummary?.marks}
                    </div>
                </div>

                {/* Performance Breakdown */}
                <div className="mt-8 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Performance Breakdown</h2>
                </div>

                {/* Question-wise Marking */}
                <div className="rounded-md border border-[#e6e3d8]">
                    <div className="rounded-t-md border-b border-[#e6e3d8] bg-[#faf9f5] px-4 py-2">
                        <h3 className="text-sm font-medium text-gray-700">Question-wise Marking</h3>
                    </div>
                </div>

                <div className="-mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-[#f8f4e8]">
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Q No.
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Question
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Answer
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Marks
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Feedback
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-left font-medium">
                                    Description
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentSummary?.summary.evaluation_result.section_wise_results[0]?.question_wise_results.map(
                                (question) => (
                                    <tr className="bg-[#faf9f5]" key={question.question_id}>
                                        <td className="border border-[#e6e3d8] p-2">
                                            {question.question_order}
                                            {')'}
                                        </td>
                                        <td
                                            className="border border-[#e6e3d8] p-2"
                                            dangerouslySetInnerHTML={{
                                                __html:
                                                    question.question_text.replace(
                                                        /^\[\[(.*)\]\]$/s,
                                                        '$1'
                                                    ) ?? '',
                                            }}
                                        />
                                        <td className="border border-[#e6e3d8] p-2">
                                            {(() => {
                                                const answerHtml =
                                                    studentSummary?.summary.section_wise_ans_extracted[0]?.question_wise_ans_extracted
                                                        .find(
                                                            (ans) =>
                                                                ans.question_id ===
                                                                question.question_id
                                                        )
                                                        ?.answer_html.replace(
                                                            /^\[\[(.*)\]\]$/s,
                                                            '$1'
                                                        ) ?? '';

                                                const plainText = answerHtml
                                                    .replace(/<[^>]+>/g, '') // Strip HTML tags
                                                    .trim();
                                                const words = plainText.split(/\s+/);
                                                const preview = words.slice(0, 5).join(' ');
                                                const hasMore = words.length > 5;

                                                return (
                                                    <>
                                                        <span>{preview}</span>
                                                        {hasMore && (
                                                            <>
                                                                {'... '}
                                                                <button
                                                                    className="text-primary-500 underline"
                                                                    onClick={() => {
                                                                        setPreviewText({
                                                                            first:
                                                                                question.question_text
                                                                                    .replace(
                                                                                        /<[^>]+>/g,
                                                                                        ''
                                                                                    )
                                                                                    .replace(
                                                                                        /^\[\[(.*)\]\]$/s,
                                                                                        '$1'
                                                                                    ) ?? ''.trim(),
                                                                            second: answerHtml,
                                                                        });
                                                                        setOpenPreview(true);
                                                                    }}
                                                                >
                                                                    View More
                                                                </button>
                                                            </>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </td>

                                        <td className="border border-[#e6e3d8] p-2">
                                            {question.marks_obtained}
                                            {'/'}
                                            {question.total_marks}
                                        </td>
                                        <td className="w-72 border border-[#e6e3d8] p-2">
                                            {question.feedback}
                                        </td>
                                        <td className="w-72 border border-[#e6e3d8] p-2">
                                            {question.description}
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                    <MyDialog
                        open={openPreview}
                        onOpenChange={() => {
                            setPreviewText({
                                first: '',
                                second: '',
                            });
                            setOpenPreview(false);
                        }}
                        heading="View Question"
                        dialogWidth="min-w-fit"
                    >
                        <div className="space-y-4 p-5">
                            <p>
                                <strong>Question </strong>
                                <br />

                                {previewText.first}
                            </p>
                            <p>
                                <strong>Extracted Answer </strong>
                                <br />
                                <div
                                    className="list-item"
                                    dangerouslySetInnerHTML={{
                                        __html: previewText.second,
                                    }}
                                />
                            </p>
                        </div>
                    </MyDialog>
                </div>
            </div>
        </div>
    );
}
