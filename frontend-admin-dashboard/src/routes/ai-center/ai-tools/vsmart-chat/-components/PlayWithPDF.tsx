import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyInput } from '@/components/design-system/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { GenerateCard } from '@/routes/ai-center/-components/GenerateCard';
import { useAICenter } from '@/routes/ai-center/-contexts/useAICenterContext';
import {
    handleChatWithPDF,
    handleStartProcessUploadedFile,
} from '@/routes/ai-center/-services/ai-center-service';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

export interface QuestionWithAnswerChatInterface {
    id: string;
    question: string;
    response: string;
}

const PlayWithPDF = ({
    isListMode = false,
    chatResponse,
    input_id,
    parent_id,
    task_name,
}: {
    isListMode?: boolean;
    chatResponse?: QuestionWithAnswerChatInterface[];
    input_id?: string;
    parent_id?: string;
    task_name?: string;
}) => {
    const [taskName, setTaskName] = useState(task_name ?? '');
    const instituteId = getInstituteId();
    const { setLoader, key, setKey } = useAICenter();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadedFilePDFId, setUploadedFilePDFId] = useState(input_id ?? '');
    const [fileUploading, setFileUploading] = useState(false);
    const [open, setOpen] = useState(isListMode);
    const [question, setQuestion] = useState('');
    const [questionsWithAnswers, setQuestionsWithAnswers] = useState<
        QuestionWithAnswerChatInterface[]
    >(chatResponse ?? []);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [parentId, setParentId] = useState(parent_id ?? '');
    const [pendingResponse, setPendingResponse] = useState(false);

    const handleUploadClick = () => {
        setKey('chat');
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
                    setUploadedFilePDFId(response.pdf_id);
                    setFileUploading(true);
                    setLoader(false);
                    setOpen(true);
                    setParentId('');
                }
            }
            event.target.value = '';
        }
    };

    /* Adding Polling For Response */
    const MAX_POLL_ATTEMPTS = 10;
    const pollingCountRef = useRef(0);
    const pollingTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
    const pendingRef = useRef(false);

    const clearPolling = () => {
        if (pollingTimeoutIdRef.current) {
            setLoader(false);
            setKey(null);
            clearTimeout(pollingTimeoutIdRef.current);
            pollingTimeoutIdRef.current = null;
        }
    };

    const getQuestionResponseMutation = useMutation({
        mutationFn: async ({
            pdfId,
            userPrompt,
            taskName,
            parentId,
        }: {
            pdfId: string;
            userPrompt: string;
            taskName: string;
            parentId: string;
        }) => {
            return handleChatWithPDF(pdfId, userPrompt, taskName, parentId);
        },
        onSuccess: (response) => {
            // Check if response indicates pending state
            if (response?.status === 'pending') {
                pendingRef.current = true;
                // Don't schedule next poll - we'll wait for an error to resume
                return;
            }

            // Reset pending state if response is no longer pending
            pendingRef.current = false;

            // If we have complete data, we're done
            if (response) {
                setQuestionsWithAnswers(response);
                if (parentId === '') setParentId(response[0].id);
                setQuestion('');
                setPendingResponse(false);
                return;
            }

            // Otherwise schedule next poll
            scheduleNextPoll();
        },
        onError: () => {
            // If we were in a pending state, resume polling on error
            if (pendingRef.current) {
                pendingRef.current = false;
                scheduleNextPoll();
                setPendingResponse(true);
                return;
            }

            // Normal error handling
            pollingCountRef.current += 1;
            if (pollingCountRef.current >= MAX_POLL_ATTEMPTS) {
                setLoader(false);
                setKey(null);
                clearPolling();
                setPendingResponse(false);
                return;
            }

            // Schedule next poll on error (if not max attempts)
            scheduleNextPoll();
        },
    });

    const scheduleNextPoll = () => {
        setLoader(false);
        setKey(null);
        clearPolling(); // Clear any existing timeout

        // Only schedule next poll if not in pending state
        if (!pendingRef.current) {
            setLoader(true);
            setKey('chat');
            pollingTimeoutIdRef.current = setTimeout(() => {
                pollGenerateAssessment();
            }, 10000);
        }
    };

    const pollGenerateAssessment = () => {
        // Don't call API if in pending state
        if (pendingRef.current) {
            return;
        }
        getQuestionResponseMutation.mutate({
            pdfId: uploadedFilePDFId,
            userPrompt: question,
            taskName: taskName,
            parentId: parentId,
        });
    };

    const handleAddQuestions = () => {
        if (!uploadedFilePDFId) return;
        setPendingResponse(true);

        clearPolling();
        pollingCountRef.current = 0;
        pendingRef.current = false;

        // Make initial call
        pollGenerateAssessment();
    };

    useEffect(() => {
        return () => {
            clearPolling();
        };
    }, []);

    useEffect(() => {
        if (key === 'chat') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    // Scroll to bottom on update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [questionsWithAnswers]);

    return (
        <>
            {!isListMode && (
                <GenerateCard
                    handleUploadClick={handleUploadClick}
                    fileInputRef={fileInputRef}
                    handleFileChange={handleFileChange}
                    cardTitle="Play With PDF"
                    cardDescription="Upload PDF/DOCX/PPT"
                    inputFormat=".pdf,.doc,.docx,.ppt,.pptx,.html"
                    keyProp="chat"
                    taskName={taskName}
                    setTaskName={setTaskName}
                />
            )}
            {(uploadedFilePDFId.length > 0 || isListMode) && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="!m-0 flex !h-full !w-full !max-w-full flex-col !rounded-none !p-0">
                        {/* Scrollable messages container */}
                        <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-6">
                            <div className="w-full max-w-[800px] space-y-6">
                                {questionsWithAnswers.map((qa) => (
                                    <div key={qa.id} className="flex flex-col gap-2">
                                        <div className="flex justify-end">
                                            <p className="rounded-xl bg-neutral-100 px-4 py-2 text-black">
                                                {qa.question}
                                            </p>
                                        </div>
                                        <div className="flex justify-start">
                                            <p
                                                className="rounded-xl bg-blue-100 px-4 py-2 text-black"
                                                dangerouslySetInnerHTML={{
                                                    __html: qa.response || '',
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input at bottom */}
                        <div className="border-t px-4 py-6">
                            <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-3">
                                {questionsWithAnswers.length === 0 && (
                                    <>
                                        <h1 className="text-center text-2xl font-semibold">
                                            What can I help with?
                                        </h1>
                                        <div className="space-y-1 text-center text-sm text-neutral-400">
                                            <p>What is the main idea of this pdf?</p>
                                            <p>
                                                Can you explain the concept of topics mentioned in
                                                this pdf?
                                            </p>
                                            <p>
                                                Give a summary of the key points discussed in this
                                                pdf.
                                            </p>
                                        </div>
                                    </>
                                )}
                                <div className="flex h-10 items-center justify-start gap-1">
                                    <MyInput
                                        inputType="text"
                                        inputPlaceholder="Ask anything"
                                        input={question}
                                        onChangeFunction={(e) => setQuestion(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddQuestions();
                                            }
                                        }}
                                        required={true}
                                        size="large"
                                        className="w-[500px] rounded-xl px-6 py-4"
                                    />
                                    {pendingResponse && <DashboardLoader size={18} />}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export default PlayWithPDF;
