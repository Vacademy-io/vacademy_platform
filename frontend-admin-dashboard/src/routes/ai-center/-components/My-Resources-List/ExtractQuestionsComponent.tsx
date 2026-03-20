import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { handleGenerateAssessmentQuestions } from '../../-services/ai-center-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import AITasksList from '../AITasksList';
import { getRandomTaskName } from '../../-utils/helper';

const ExtractQuestionsComponent = ({ fileId }: { fileId: string }) => {
    const [prompt, setPrompt] = useState('');
    const [enableDialog, setEnableDialog] = useState(false);
    const [extractQuestionsDialog, setExtractQuestionsDialog] = useState(false);
    const queryClient = useQueryClient();

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
            return handleGenerateAssessmentQuestions(pdfId, userPrompt, taskName, taskId || '');
        },
        onSuccess: () => {
            setPrompt('');
            setEnableDialog(true);
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['GET_INDIVIDUAL_AI_LIST_DATA'] });
            }, 100);
        },
        onError: (error: unknown) => {
            console.log(error);
        },
    });

    const handleExtractQuestions = () => {
        generateAssessmentMutation.mutate({
            pdfId: fileId || '',
            userPrompt: prompt || '',
            taskName: getRandomTaskName(),
            taskId: '',
        });
    };

    const handleCloseExtractQuestionDialog = () => {
        setExtractQuestionsDialog(!extractQuestionsDialog);
        setEnableDialog(false);
    };

    return (
        <>
            <Dialog open={extractQuestionsDialog} onOpenChange={handleCloseExtractQuestionDialog}>
                <DialogTrigger>
                    <Badge className="cursor-pointer whitespace-nowrap bg-[#F4FFF9]">
                        Extract Questions
                    </Badge>
                </DialogTrigger>
                <DialogContent className="p-0">
                    <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                        Extract Questions
                    </h1>
                    <div className="flex flex-col gap-4 p-4">
                        <MyInput
                            inputType="text"
                            inputPlaceholder="Enter Your Prompt Here"
                            input={prompt}
                            onChangeFunction={(e) => setPrompt(e.target.value)}
                            required={true}
                            label="Prompt"
                            className="w-full"
                        />
                        {generateAssessmentMutation.status === 'pending' ? (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="primary"
                                layoutVariant="default"
                                className="text-sm"
                            >
                                <DashboardLoader />
                            </MyButton>
                        ) : (
                            <MyButton
                                type="button"
                                scale="medium"
                                buttonType="primary"
                                layoutVariant="default"
                                className="text-sm"
                                onClick={handleExtractQuestions}
                                disable={!prompt}
                            >
                                Extract
                            </MyButton>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {enableDialog && (
                <AITasksList
                    heading="Vsmart Extract"
                    enableDialog={enableDialog}
                    setEnableDialog={setEnableDialog}
                />
            )}
        </>
    );
};

export default ExtractQuestionsComponent;
