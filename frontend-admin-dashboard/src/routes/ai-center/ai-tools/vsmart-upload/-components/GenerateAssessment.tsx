import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef, useState } from 'react';
import {
    handleConvertPDFToHTML,
    handleGenerateAssessmentQuestions,
    handleStartProcessUploadedFile,
} from '@/routes/ai-center/-services/ai-center-service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import GeneratePageWiseAssessment from './GeneratePageWiseAssessment';
import { GenerateAssessmentDialog } from './GenerateAssessmentDialog';
import { GenerateCard } from '@/routes/ai-center/-components/GenerateCard';
import { useAICenter } from '@/routes/ai-center/-contexts/useAICenterContext';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';

const GenerateAIAssessmentComponent = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const queryClient = useQueryClient();
    const [allPagesGenerateQuestionsStatus, setAllPagesGenerateQuestionsStatus] = useState(false);
    const [pageWiseGenerateQuestionsStatus, setPageWiseGenerateQuestionsStatus] = useState(false);
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { setLoader, key, setKey } = useAICenter();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [openAssessmentDialog, setOpenAssessmentDialog] = useState(false);
    const [uploadedFilePDFId, setUploadedFilePDFId] = useState('');
    const [htmlData, setHtmlData] = useState(null);
    const [openPageWiseAssessmentDialog, setOpenPageWiseAssessmentDialog] = useState(false);
    const [fileUploading, setFileUploading] = useState(false);

    const handleOpenAssessmentDialog = (open: boolean) => {
        setOpenAssessmentDialog(open);
    };

    const handleUploadClick = () => {
        setKey('assessment');
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileId = await uploadFile({
                file,
                setIsUploading: setFileUploading,
                userId: 'your-user-id',
                source: instituteId,
                sourceId: 'STUDENTS',
            });
            if (fileId) {
                const response = await handleStartProcessUploadedFile(fileId);
                if (response) {
                    setOpenAssessmentDialog(true);
                    setUploadedFilePDFId(response.pdf_id);
                }
            }
            event.target.value = '';
        }
    };

    /* Generate Assessment Complete */
    const generateAssessmentMutation = useMutation({
        mutationFn: ({
            pdfId,
            userPrompt,
            taskName,
            taskId,
        }: {
            pdfId: string;
            userPrompt: string;
            taskName: string;
            taskId?: string;
        }) => {
            setLoader(true);
            setKey('assessment');
            return handleGenerateAssessmentQuestions(pdfId, userPrompt, taskName, taskId || '');
        },
        onMutate: () => {
            setAllPagesGenerateQuestionsStatus(true);
        },
        onSuccess: () => {
            setAllPagesGenerateQuestionsStatus(false);
            setLoader(false);
            setKey(null);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const pollGenerateAssessment = (prompt?: string, taskId?: string) => {
        generateAssessmentMutation.mutate({
            pdfId: uploadedFilePDFId,
            userPrompt: '',
            taskName,
            taskId,
        });
    };

    /* Generate Assessment Pagewise */
    const convertPollingCountRef = useRef(0);
    const convertPollingTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
    const MAX_CONVERT_ATTEMPTS = 10;
    const convertPendingRef = useRef(false);

    const handleConvertPDFToHTMLMutation = useMutation({
        mutationFn: ({ pdfId, taskName }: { pdfId: string; taskName: string }) =>
            handleConvertPDFToHTML(pdfId, taskName),
        onSuccess: async (response) => {
            // Check if response indicates pending state
            if (response?.status === 'pending') {
                setPageWiseGenerateQuestionsStatus(true);
                convertPendingRef.current = true;
                // Don't schedule next poll - we'll wait for an error to resume
                return;
            }

            // Reset pending state
            convertPendingRef.current = false;

            // If conversion is complete and we have HTML data
            if (response === 'Done' || response?.html) {
                setPageWiseGenerateQuestionsStatus(false);
                stopConvertPolling();
                setHtmlData(response?.html);
                setOpenPageWiseAssessmentDialog(true);

                return;
            }

            // If response exists but no HTML yet, schedule next poll
            scheduleNextConvertPoll();
        },
        onError: (error: unknown) => {
            console.error('⛔️ Convert Error:', error);

            // If we were in a pending state, resume polling on error
            if (convertPendingRef.current) {
                setPageWiseGenerateQuestionsStatus(true);
                convertPendingRef.current = false;
                scheduleNextConvertPoll();
                return;
            }

            // Increment count and check max attempts
            convertPollingCountRef.current += 1;
            if (convertPollingCountRef.current >= MAX_CONVERT_ATTEMPTS) {
                setPageWiseGenerateQuestionsStatus(false);
                stopConvertPolling();
                return;
            }

            // Schedule next poll if not max attempts yet
            scheduleNextConvertPoll();
        },
    });

    const stopConvertPolling = () => {
        if (convertPollingTimeoutIdRef.current) {
            clearTimeout(convertPollingTimeoutIdRef.current);
            convertPollingTimeoutIdRef.current = null;
        }
    };

    const scheduleNextConvertPoll = () => {
        stopConvertPolling(); // Clear any existing timeout

        // Only schedule next poll if not in pending state
        if (!convertPendingRef.current) {
            console.log('Scheduling next conversion poll in 10 seconds');
            convertPollingTimeoutIdRef.current = setTimeout(() => {
                pollConvertPDFToHTML();
            }, 10000);
        }
    };

    const pollConvertPDFToHTML = () => {
        // Don't call API if in pending state
        if (convertPendingRef.current) {
            return;
        }
        handleConvertPDFToHTMLMutation.mutate({ pdfId: uploadedFilePDFId, taskName });
    };

    const handleConvertPDFToHTMLFn = () => {
        if (!uploadedFilePDFId) return;
        stopConvertPolling();
        convertPollingCountRef.current = 0;
        convertPendingRef.current = false;
        setPageWiseGenerateQuestionsStatus(true);
        // Make initial call
        pollConvertPDFToHTML();
    };

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopConvertPolling();
        };
    }, []);

    useEffect(() => {
        if (key === 'assessment') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    return (
        <div className="flex items-center justify-start gap-8">
            <GenerateCard
                handleUploadClick={handleUploadClick}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                cardTitle="Generate Assessment"
                cardDescription="Upload PDF/DOCX/PPT"
                inputFormat=".pdf,.doc,.docx,.ppt,.pptx,.html"
                keyProp="assessment"
                taskName={taskName}
                setTaskName={setTaskName}
                pollGenerateAssessment={pollGenerateAssessment}
                sectionsForm={form}
                currentSectionIndex={currentSectionIndex}
            />
            <GenerateAssessmentDialog
                open={openAssessmentDialog}
                handleOpen={handleOpenAssessmentDialog}
                handleGenerateCompleteFile={pollGenerateAssessment}
                handleGeneratePageWise={handleConvertPDFToHTMLFn}
                allPagesGenerateQuestionsStatus={allPagesGenerateQuestionsStatus}
                pageWiseGenerateQuestionsStatus={pageWiseGenerateQuestionsStatus}
            />
            <GeneratePageWiseAssessment
                openPageWiseAssessmentDialog={openPageWiseAssessmentDialog}
                setOpenPageWiseAssessmentDialog={setOpenPageWiseAssessmentDialog}
                htmlData={htmlData}
            />
            {generateAssessmentMutation.status === 'success' && (
                <AITasksList
                    heading="Vsmart Upload"
                    enableDialog={true}
                    sectionsForm={form}
                    currentSectionIndex={currentSectionIndex}
                />
            )}
        </div>
    );
};

export default GenerateAIAssessmentComponent;
