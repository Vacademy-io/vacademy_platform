import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { StarFour, UploadSimple } from 'phosphor-react';
import { useAICenter } from '../-contexts/useAICenterContext';
import { AIToolPageData } from '../-constants/AIToolPageData';
import { GetImagesForAITools } from '../-helpers/GetImagesForAITools';
import { Separator } from '@/components/ui/separator';
import { MyInput } from '@/components/design-system/input';
import AITasksList from './AITasksList';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';
import { PromptDummyData } from './Prompt-dummy-data';
import { QuestionsFromTextData } from '../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import { UseFormReturn } from 'react-hook-form';
import { SectionFormType } from '@/types/assessments/assessment-steps';

type PromptType = keyof typeof PromptDummyData;

interface GenerateCardProps {
    handleUploadClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    cardTitle: string;
    cardDescription: string;
    inputFormat: string;
    keyProp: string | null;
    taskName: string;
    setTaskName: React.Dispatch<React.SetStateAction<string>>;
    prompt?: string;
    setPrompt?: React.Dispatch<React.SetStateAction<string>>;
    pollGenerateAssessment?: (prompt?: string, taskId?: string) => void;
    handleGenerateQuestionsForAssessment?: (
        pdfId?: string,
        prompt?: string,
        taskName?: string,
        taskId?: string
    ) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    pollGenerateQuestionsFromAudio?: (data: QuestionsFromTextData, taskId: string) => void;
    sectionsForm?: UseFormReturn<SectionFormType>;
    currentSectionIndex?: number;
}
export const GenerateCard = ({
    handleUploadClick,
    fileInputRef,
    handleFileChange,
    inputFormat,
    keyProp,
    taskName,
    setTaskName,
    prompt,
    setPrompt,
    pollGenerateAssessment,
    handleGenerateQuestionsForAssessment,
    pollGenerateQuestionsFromText,
    pollGenerateQuestionsFromAudio,
    sectionsForm,
    currentSectionIndex,
}: GenerateCardProps) => {
    const [selectedValue, setSelectedValue] = useState<PromptType>('topic');
    const { key: keyContext, loader } = useAICenter();
    const toolData = keyProp ? AIToolPageData[keyProp] : null;
    return (
        <>
            {toolData && (
                <div className="flex w-full flex-col gap-4 px-8 text-neutral-600">
                    <div className="flex w-fit items-center justify-start gap-2">
                        <div className="flex items-center gap-2 text-h2 font-semibold">
                            <StarFour size={30} weight="fill" className="text-primary-500" />{' '}
                            {toolData.heading}
                        </div>
                        <AITasksList
                            heading={toolData.heading}
                            pollGenerateAssessment={pollGenerateAssessment}
                            handleGenerateQuestionsForAssessment={
                                handleGenerateQuestionsForAssessment
                            }
                            pollGenerateQuestionsFromText={pollGenerateQuestionsFromText}
                            pollGenerateQuestionsFromAudio={pollGenerateQuestionsFromAudio}
                            sectionsForm={sectionsForm}
                            currentSectionIndex={currentSectionIndex}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        {GetImagesForAITools(toolData.key)}
                        <div className="flex flex-col gap-4">
                            {keyProp !== 'audio' && (
                                <MyInput
                                    inputType="text"
                                    inputPlaceholder="Enter Your Task Name"
                                    input={taskName}
                                    onChangeFunction={(e) => setTaskName(e.target.value)}
                                    required={true}
                                    label="Task Name"
                                />
                            )}
                            {keyProp === 'sortSplitPdf' && (
                                <div className="flex flex-col gap-2">
                                    <h1>
                                        {PromptDummyData[selectedValue].heading}
                                        <span className="text-red-500">*</span>
                                    </h1>
                                    <Textarea
                                        placeholder={PromptDummyData[selectedValue].description}
                                        className="h-[100px] w-full"
                                        value={prompt}
                                        onChange={(e) => setPrompt?.(e.target.value)}
                                    />
                                    <RadioGroup
                                        defaultValue="topic"
                                        className="mt-2"
                                        value={selectedValue}
                                        onValueChange={(newValue) =>
                                            setSelectedValue(newValue as PromptType)
                                        }
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="topic" id="r1" />
                                            <Label htmlFor="r1">
                                                Select any topic questions covered
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="pages" id="r2" />
                                            <Label htmlFor="r2">
                                                Select questions from specific pages
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="questionNo" id="r3" />
                                            <Label htmlFor="r3">Select a set of questions</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            )}
                            {loader && keyContext == keyProp && keyContext != null ? (
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="w-full text-sm"
                                >
                                    <DashboardLoader size={20} color="#ffffff" />
                                </MyButton>
                            ) : (
                                <MyButton
                                    type="button"
                                    scale="medium"
                                    buttonType="primary"
                                    layoutVariant="default"
                                    className="text-sm"
                                    onClick={handleUploadClick}
                                    disable={
                                        (keyContext !== keyProp && loader && keyContext != null) ||
                                        (keyProp !== 'audio' && !taskName)
                                    }
                                >
                                    <UploadSimple size={32} />
                                    Upload
                                </MyButton>
                            )}
                            <Input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept={inputFormat}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-h3 font-semibold">How to use {toolData.heading}</p>
                        <p className="text-subtitle">{toolData.instructionsHeading}</p>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-6">
                        {toolData.instructions.map((steps, index) => (
                            <div key={index}>
                                <div className="flex gap-2 text-title font-semibold">
                                    <p className="text-primary-500">Step {index + 1}</p>
                                    <p>{steps.stepHeading}</p>
                                </div>
                                <p>{steps.stepSubHeading}</p>
                                <ul className="flex flex-col text-body">
                                    {steps.steps.map((step, index) => (
                                        <li key={index}>
                                            <p>{step}</p>
                                        </li>
                                    ))}
                                </ul>
                                <p>{steps.stepFooter}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};
