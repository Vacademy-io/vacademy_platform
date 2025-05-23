import { useEffect, useRef, useState } from 'react';
import { GenerateCard } from '../../../-components/GenerateCard';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getInstituteId } from '@/constants/helper';
import {
    handleStartProcessUploadedAudioFile,
    handleGetQuestionsFromAudio,
} from '../../../-services/ai-center-service';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAICenter } from '../../../-contexts/useAICenterContext';
import GenerateQuestionsFromAudioForm from './GenerateQuestionsFromAudioForm';
import { QuestionsFromTextData } from '@/routes/ai-center/ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';

export const GenerateQuestionsFromAudio = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const [audioId, setAudioId] = useState('');
    const queryClient = useQueryClient();
    const [taskName, setTaskName] = useState('');
    const instituteId = getInstituteId();
    const { uploadFile } = useFileUpload();
    const { setLoader, key, setKey } = useAICenter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileUploading, setFileUploading] = useState(false);

    const handleUploadClick = () => {
        setKey('audio');
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
                    setAudioId(response.pdf_id);
                }
            }
            event.target.value = '';
        }
    };

    const getQuestionsFromAudioMutation = useMutation({
        mutationFn: async ({
            audioId,
            numQuestions,
            prompt,
            difficulty,
            language,
            taskName,
            taskId,
        }: {
            audioId: string;
            numQuestions: string;
            prompt: string;
            difficulty: string;
            language: string;
            taskName: string;
            taskId?: string;
        }) => {
            setLoader(true);
            setKey('audio');
            return handleGetQuestionsFromAudio(
                audioId,
                numQuestions,
                prompt,
                difficulty,
                language,
                taskName,
                taskId || ''
            );
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

    const pollGenerateQuestionsFromAudio = (data: QuestionsFromTextData, taskId: string) => {
        getQuestionsFromAudioMutation.mutate({
            audioId,
            numQuestions: data.num.toString(),
            prompt: data.text,
            difficulty: data.class_level,
            language: data.question_language,
            taskName: data.taskName,
            taskId: taskId,
        });
    };

    const handleCallApi = (
        audioId: string,
        numQuestions: string,
        prompt: string,
        difficulty: string,
        language: string,
        taskName: string
    ) => {
        getQuestionsFromAudioMutation.mutate({
            audioId,
            numQuestions,
            prompt,
            difficulty,
            language,
            taskName,
        });
    };

    useEffect(() => {
        if (key === 'audio') {
            if (fileUploading == true) setLoader(true);
        }
    }, [fileUploading, key]);

    return (
        <>
            <GenerateCard
                handleUploadClick={handleUploadClick}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                cardTitle="Generate Questions From Audio"
                cardDescription="Upload WAV/FLAC/MP3/AAC/M4A"
                inputFormat=".mp3,.wav,.flac,.aac,.m4a"
                keyProp="audio"
                taskName={taskName}
                setTaskName={setTaskName}
                pollGenerateQuestionsFromAudio={pollGenerateQuestionsFromAudio}
                sectionsForm={form}
                currentSectionIndex={currentSectionIndex}
            />
            {audioId !== '' && (
                <GenerateQuestionsFromAudioForm
                    audioId={audioId}
                    handleCallApi={handleCallApi}
                    status={getQuestionsFromAudioMutation.status}
                />
            )}
            {getQuestionsFromAudioMutation.status === 'success' && (
                <AITasksList
                    heading="Vsmart Audio"
                    enableDialog={true}
                    sectionsForm={form}
                    currentSectionIndex={currentSectionIndex}
                />
            )}
        </>
    );
};
