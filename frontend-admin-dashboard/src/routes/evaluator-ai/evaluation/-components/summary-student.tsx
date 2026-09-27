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
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

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

// Demo-only bearer for the deprecated Evaluator-AI tool. A real JWT used to be
// checked in here — secrets must never live in source. Supply via env for the
// demo; otherwise this is empty. (The old token/EmailJS keys must be rotated.)
const DEFAULT_ACCESS_TOKEN = import.meta.env.VITE_EVALUATOR_DEMO_TOKEN ?? '';

const buildReportSchema = (t: TFunction) =>
    z.object({
        email: z.string().email(t('validation.invalidEmail')),
        subject: z.string().optional(),
        remarks: z.string().optional(),
    });

type ReportFormValues = z.infer<ReturnType<typeof buildReportSchema>>;

export default function EvaluationSummary() {
    const { t } = useTranslation('evaluatorAiEvaluationSummaryStudent');
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
        resolver: zodResolver(buildReportSchema(t)),
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
            // EmailJS service/template/public-key come from env — the previously
            // checked-in values were live credentials and must be rotated.
            await emailjs.send(
                import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '',
                import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '',
                {
                    to_email: data.email,
                    subject: data.subject || t('email.defaultSubject'),
                    name: studentSummary?.name || t('email.defaultStudentName'),
                    message:
                        data.remarks ||
                        studentSummary?.summary.evaluation_result.overall_description,
                    buttonLink: fileUrl,
                },
                import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? ''
            );

            console.log('Email sent with PDF link:', fileUrl);
            toast.success(t('toast.emailSent'));
        } catch (err) {
            toast.error(t('toast.emailFailed'));
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
                        {isUploading && t('loading.generatingPdf')}
                        {sendingMail && t('loading.sendingMail')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t('loading.pleaseWait')}
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
                        {t('header.back')}
                    </Button>
                    <h1 className="text-base font-bold text-gray-800">{t('header.title')}</h1>
                </div>
                <span className="flex items-center gap-2">
                    <Button
                        variant={'outline'}
                        onClick={() => {
                            toPDF();
                        }}
                    >
                        {t('header.exportReport')}
                    </Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button variant={'outline'}>
                                <Mail className="size-4" />
                                {t('header.sendReport')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('sendDialog.title')}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div>
                                    <Input
                                        type="email"
                                        placeholder={t('sendDialog.recipientEmailPlaceholder')}
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
                                        placeholder={t('sendDialog.subjectPlaceholder')}
                                        {...register('subject')}
                                    />
                                </div>
                                <div>
                                    <Textarea
                                        placeholder={t('sendDialog.remarksPlaceholder')}
                                        {...register('remarks')}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit">{t('sendDialog.sendButton')}</Button>
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
                        <h2 className="text-sm font-medium text-gray-700">
                            {t('sections.studentInformation')}
                        </h2>
                    </div>
                </div>

                <div className="-mt-4 flex flex-wrap justify-between px-1 text-sm">
                    <div className="flex gap-2">
                        <span className="text-gray-600">{t('fields.name')}</span>
                        <span>{studentSummary?.name}</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-gray-600">{t('fields.learnerId')}</span>
                        <span>{studentSummary?.id}</span>
                    </div>
                </div>

                {/* Evaluation Summary */}
                <h2 className="mt-8 text-base font-bold text-gray-800">{t('header.title')}</h2>

                {/* Evaluation Details */}
                <div className="rounded-md border border-[#e6e3d8]">
                    <div className="rounded-t-md border-b border-[#e6e3d8] bg-[#faf9f5] px-4 py-2">
                        <h3 className="text-sm font-medium text-gray-700">
                            {t('sections.evaluationDetails')}
                        </h3>
                    </div>
                </div>

                <div className="-mt-4 space-y-4 px-1">
                    <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-gray-600">{t('fields.assessment')}</span>
                        <span>{studentSummary?.assessment}</span>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 text-sm">
                        <span className="w-16 text-gray-600">{t('fields.summary')}</span>
                        <span className="flex-1">
                            {studentSummary?.summary.evaluation_result.overall_description}
                        </span>
                    </div>
                </div>

                <div className="absolute end-14 mt-[-100px]">
                    <div className="text-xs text-gray-600">{t('fields.totalMarks')}</div>
                    <div className="text-center text-2xl font-bold text-orange-500">
                        {studentSummary?.marks}
                    </div>
                </div>

                {/* Performance Breakdown */}
                <div className="mt-8 flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">
                        {t('sections.performanceBreakdown')}
                    </h2>
                </div>

                {/* Question-wise Marking */}
                <div className="rounded-md border border-[#e6e3d8]">
                    <div className="rounded-t-md border-b border-[#e6e3d8] bg-[#faf9f5] px-4 py-2">
                        <h3 className="text-sm font-medium text-gray-700">
                            {t('sections.questionWiseMarking')}
                        </h3>
                    </div>
                </div>

                <div className="-mt-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-[#f8f4e8]">
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.questionNo')}
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.question')}
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.answer')}
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.marks')}
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.feedback')}
                                </th>
                                <th className="border border-[#e6e3d8] p-2 text-start font-medium">
                                    {t('table.description')}
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
                                                                    {t('table.viewMore')}
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
                        heading={t('previewDialog.heading')}
                        dialogWidth="min-w-fit"
                    >
                        <div className="space-y-4 p-5">
                            <p>
                                <strong>{t('previewDialog.questionLabel')} </strong>
                                <br />

                                {previewText.first}
                            </p>
                            <p>
                                <strong>{t('previewDialog.extractedAnswerLabel')} </strong>
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
