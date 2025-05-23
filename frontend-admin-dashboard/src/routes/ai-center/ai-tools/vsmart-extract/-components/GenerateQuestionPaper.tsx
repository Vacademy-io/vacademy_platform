import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef, useState } from 'react';
import {
    handleGenerateAssessmentQuestions,
    handleStartProcessUploadedFile,
} from '../../../-services/ai-center-service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GenerateCard } from '../../../-components/GenerateCard';
import { useAICenter } from '../../../-contexts/useAICenterContext';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';

const GenerateAiQuestionPaperComponent = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const queryClient = useQueryClient();
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { setLoader, key, setKey } = useAICenter();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [fileUploading, setFileUploading] = useState(false);

    const handleUploadClick = () => {
        setKey('question');
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
                    pollGenerateAssessment(response.pdf_id, '', '');
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
            setKey('question');
            return handleGenerateAssessmentQuestions(pdfId, userPrompt, taskName, taskId || '');
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

    const pollGenerateAssessment = (pdfId?: string, prompt?: string, taskId?: string) => {
        generateAssessmentMutation.mutate({
            pdfId: pdfId || '',
            userPrompt: prompt || '',
            taskName,
            taskId,
        });
    };

    useEffect(() => {
        if (key === 'question') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    return (
        <>
            <GenerateCard
                handleUploadClick={handleUploadClick}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                cardTitle="Extract Question"
                cardDescription="Upload PDF/DOCX/PPT"
                inputFormat=".pdf,.doc,.docx,.ppt,.pptx,.html"
                keyProp="question"
                taskName={taskName}
                setTaskName={setTaskName}
                pollGenerateAssessment={pollGenerateAssessment}
                sectionsForm={form}
                currentSectionIndex={currentSectionIndex}
            />
            {generateAssessmentMutation.status === 'success' && (
                <AITasksList
                    heading="Vsmart Extract"
                    enableDialog={true}
                    sectionsForm={form}
                    currentSectionIndex={currentSectionIndex}
                />
            )}
        </>
    );
};

export default GenerateAiQuestionPaperComponent;
