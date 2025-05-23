import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef, useState } from 'react';
import {
    handleSortSplitPDF,
    handleStartProcessUploadedFile,
} from '../../../-services/ai-center-service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GenerateCard } from '../../../-components/GenerateCard';
import { useAICenter } from '../../../-contexts/useAICenterContext';
import AITasksList from '@/routes/ai-center/-components/AITasksList';

const SortAndSplitTopicQuestions = () => {
    const [prompt, setPrompt] = useState('');
    const queryClient = useQueryClient();
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [uploadedFilePDFId, setUploadedFilePDFId] = useState('');
    const { setLoader, key, setKey } = useAICenter();
    const [fileUploading, setFileUploading] = useState(false);

    const handleUploadClick = () => {
        setKey('sortSplitPdf');
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
                    handleGenerateQuestionsForAssessment(response.pdf_id, prompt);
                }
            }
            event.target.value = '';
        }
    };

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
            taskId: string;
        }) => {
            setLoader(true);
            setKey('sortSplitPdf');
            return handleSortSplitPDF(pdfId, userPrompt, taskName, taskId);
        },
        onSuccess: () => {
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

    const handleGenerateQuestionsForAssessment = (
        pdfId = uploadedFilePDFId,
        prompt = '',
        taskId = ''
    ) => {
        // Use pdfId in your mutation call
        generateAssessmentMutation.mutate({ pdfId: pdfId, userPrompt: prompt, taskName, taskId });
    };
    useEffect(() => {
        if (key === 'sortSplitPdf') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    return (
        <>
            <GenerateCard
                handleUploadClick={handleUploadClick}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                cardTitle="Sort and split topic questions from PDF"
                cardDescription="Upload PDF/DOCX/PPT"
                inputFormat=".pdf,.doc,.docx,.ppt,.pptx,.html"
                keyProp="sortSplitPdf"
                taskName={taskName}
                setTaskName={setTaskName}
                prompt={prompt}
                setPrompt={setPrompt}
                handleGenerateQuestionsForAssessment={handleGenerateQuestionsForAssessment}
            />
            {generateAssessmentMutation.status === 'success' && (
                <AITasksList heading="Vsmart Organizer" enableDialog={true} />
            )}
        </>
    );
};

export default SortAndSplitTopicQuestions;
