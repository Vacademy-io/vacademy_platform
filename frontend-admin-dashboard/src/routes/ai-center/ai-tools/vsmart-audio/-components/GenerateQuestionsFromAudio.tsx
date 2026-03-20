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
import type { QuestionsFromTextData } from '@/routes/ai-center/ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import AITasksList from '@/routes/ai-center/-components/AITasksList';
import { useForm, UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';
import {
    AudioAIQuestionFormSchema,
    audioQuestionsFormSchema,
} from '@/routes/ai-center/-utils/audio-questions-schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { languageSupport } from '@/constants/dummy-data';
import { getRandomTaskName } from '@/routes/ai-center/-utils/helper';

export const GenerateQuestionsFromAudio = ({
    form,
    currentSectionIndex,
}: {
    form?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}) => {
    const audioQuesitionsForm = useForm<AudioAIQuestionFormSchema>({
        resolver: zodResolver(audioQuestionsFormSchema),
        defaultValues: {
            numQuestions: '',
            prompt: '',
            difficulty: '',
            language: languageSupport[0],
            taskName: getRandomTaskName(),
            preferredModel: undefined, // Will use default model
        },
    });

    const [audioId, setAudioId] = useState('');
    const queryClient = useQueryClient();
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
            preferredModel,
        }: {
            audioId: string;
            numQuestions: string;
            prompt: string;
            difficulty: string;
            language: string;
            taskName: string;
            taskId?: string;
            preferredModel?: string;
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
                taskId || '',
                preferredModel
            );
        },
        onSuccess: () => {
            setLoader(false);
            setKey(null);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
            audioQuesitionsForm.reset();
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
            taskName: getRandomTaskName(),
            taskId: taskId,
        });
    };

    const handleCallApi = (
        audioId: string,
        numQuestions: string,
        prompt: string,
        difficulty: string,
        language: string,
        preferredModel?: string
    ) => {
        getQuestionsFromAudioMutation.mutate({
            audioId,
            numQuestions,
            prompt,
            difficulty,
            language,
            taskName: getRandomTaskName(),
            preferredModel,
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
                pollGenerateQuestionsFromAudio={pollGenerateQuestionsFromAudio}
                sectionsForm={form}
                currentSectionIndex={currentSectionIndex}
            />
            {audioId !== '' && (
                <GenerateQuestionsFromAudioForm
                    form={audioQuesitionsForm}
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
