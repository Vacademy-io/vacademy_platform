import { GenerateCard } from '@/routes/ai-center/-components/GenerateCard';
import { getInstituteId } from '@/constants/helper';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAICenter } from '@/routes/ai-center/-contexts/useAICenterContext';
import {
    handleEvaluateLecture,
    handleStartProcessUploadedAudioFile,
} from '@/routes/ai-center/-services/ai-center-service';
import AITasksList from '@/routes/ai-center/-components/AITasksList';

const EvaluateLectureAI = () => {
    const queryClient = useQueryClient();
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { setLoader, key, setKey } = useAICenter();
    const { uploadFile } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [fileUploading, setFileUploading] = useState(false);

    const handleUploadClick = () => {
        setKey('evaluateLecture');
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
                const response = await handleStartProcessUploadedAudioFile(fileId);
                if (response) {
                    pollGenerateAssessment(response.pdf_id);
                }
            }
            event.target.value = '';
        }
    };

    /* Generate Assessment Complete */
    const generateAssessmentMutation = useMutation({
        mutationFn: ({ pdfId, taskName }: { pdfId: string; taskName: string }) => {
            setLoader(true);
            setKey('evaluateLecture');
            return handleEvaluateLecture(pdfId, taskName);
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

    const pollGenerateAssessment = (pdfId: string) => {
        generateAssessmentMutation.mutate({
            pdfId: pdfId,
            taskName,
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
                cardTitle="Evaluate Lecture"
                cardDescription="Upload WAV/FLAC/MP3/AAC/M4A"
                inputFormat=".mp3,.wav,.flac,.aac,.m4a"
                keyProp="evaluateLecture"
                taskName={taskName}
                setTaskName={setTaskName}
            />
            {generateAssessmentMutation.status === 'success' && (
                <AITasksList heading="Vsmart Feedback" enableDialog={true} />
            )}
        </>
    );
};

export default EvaluateLectureAI;
