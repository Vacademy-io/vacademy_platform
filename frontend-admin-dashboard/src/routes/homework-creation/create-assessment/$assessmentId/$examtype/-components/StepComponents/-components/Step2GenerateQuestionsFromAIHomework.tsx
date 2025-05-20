import { MyButton } from '@/components/design-system/button';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { StarFour, X } from 'phosphor-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { AICenterProvider } from '@/routes/ai-center/-contexts/useAICenterContext';
import GenerateAIAssessmentComponent from '@/routes/ai-center/ai-tools/vsmart-upload/-components/GenerateAssessment';
import { GenerateQuestionsFromAudio } from '@/routes/ai-center/ai-tools/vsmart-audio/-components/GenerateQuestionsFromAudio';
import { GenerateQuestionsFromText } from '@/routes/ai-center/ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText';
import GenerateAiQuestionPaperComponent from '@/routes/ai-center/ai-tools/vsmart-extract/-components/GenerateQuestionPaper';
import GenerateAiQuestionFromImageComponent from '@/routes/ai-center/ai-tools/vsmart-image/-components/GenerateQuestionPaper';
import { UseFormReturn } from 'react-hook-form';
import sectionDetailsSchema from '../../../-utils/section-details-schema';
import { z } from 'zod';
import { useAIQuestionDialogStore } from '@/routes/assessment/create-assessment/$assessmentId/$examtype/-utils/zustand-global-states/ai-add-questions-dialog-zustand';

type SectionFormType = z.infer<typeof sectionDetailsSchema>;
const Step2GenerateQuestionsFromAIHomework = ({
    form,
    index,
}: {
    form: UseFormReturn<SectionFormType>;
    index: number;
}) => {
    const {
        isAIQuestionDialog1,
        setIsAIQuestionDialog1,
        isAIQuestionDialog2,
        setIsAIQuestionDialog2,
        isAIQuestionDialog3,
        setIsAIQuestionDialog3,
        isAIQuestionDialog4,
        setIsAIQuestionDialog4,
        isAIQuestionDialog5,
        setIsAIQuestionDialog5,
        isAIQuestionDialog6,
        setIsAIQuestionDialog6,
        isAIQuestionDialog7,
        setIsAIQuestionDialog7,
        isAIQuestionDialog8,
        setIsAIQuestionDialog8,
    } = useAIQuestionDialogStore();
    return (
        <AlertDialog open={isAIQuestionDialog6} onOpenChange={setIsAIQuestionDialog6}>
            <AlertDialogTrigger>
                <MyButton type="button" scale="large" buttonType="secondary" className="font-thin">
                    <StarFour weight="fill" className="text-primary-500" />
                    Create From AI <span className="text-xs">(Vacademy AI)</span>
                </MyButton>
            </AlertDialogTrigger>
            <AlertDialogContent className="p-0">
                <div className="flex items-center justify-between rounded-md bg-primary-50">
                    <h1 className="rounded-sm p-4 font-bold text-primary-500">
                        Create Questions From AI
                    </h1>
                    <AlertDialogCancel className="border-none bg-primary-50 shadow-none hover:bg-primary-50">
                        <X className="text-neutral-600" />
                    </AlertDialogCancel>
                </div>
                <div className="flex flex-col gap-4 px-4 pb-4">
                    {/* Generate Questions */}
                    <Dialog open={isAIQuestionDialog7} onOpenChange={setIsAIQuestionDialog7}>
                        <DialogTrigger>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <StarFour weight="fill" className="text-primary-500" />
                                        Generate Questions
                                    </CardTitle>
                                    <CardDescription>
                                        Ask AI to use PDF, Image or any topic to generate new
                                        questions
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </DialogTrigger>
                        <DialogContent className="no-scrollbar !m-0 flex size-1/2 flex-col !gap-0 !p-0">
                            <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                                Generate Questions
                            </h1>
                            <div className="flex flex-col gap-4 overflow-auto p-4">
                                <Dialog
                                    open={isAIQuestionDialog1}
                                    onOpenChange={setIsAIQuestionDialog1}
                                >
                                    <DialogTrigger>
                                        <Card className="flex h-fit w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 text-neutral-600 sm:flex-wrap md:flex-nowrap">
                                            <CardHeader className="flex h-fit flex-col gap-3">
                                                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                                                    <StarFour
                                                        size={30}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                    VSmart Upload
                                                    <p className="text-body">
                                                        (Generate questions by uploading pdf, doc
                                                        and ppt files)
                                                    </p>
                                                </CardTitle>
                                                <CardDescription className="flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p>
                                                            Generate question papers instantly by
                                                            uploading study materials in PDF, Word,
                                                            or PowerPoint formats. Vsmart Upload
                                                            uses AI to analyze your entire file and
                                                            create relevant, well-structured
                                                            questions — or lets you paste content
                                                            manually if preferred. No formatting
                                                            needed, just plug and go. Perfect for
                                                            educators, exam setters, and corporate
                                                            trainers who work with existing content
                                                            like lecture slides, study guides, or
                                                            course handouts. Whether you are
                                                            preparing assessments for a classroom, a
                                                            coaching batch, or a training session —
                                                            Vsmart Upload saves hours of effort by
                                                            turning your materials into ready-to-use
                                                            question papers.
                                                        </p>
                                                    </div>
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                                        <AICenterProvider>
                                            <GenerateAIAssessmentComponent
                                                form={form}
                                                currentSectionIndex={index}
                                            />
                                        </AICenterProvider>
                                    </DialogContent>
                                </Dialog>
                                <Dialog
                                    open={isAIQuestionDialog2}
                                    onOpenChange={setIsAIQuestionDialog2}
                                >
                                    <DialogTrigger>
                                        <Card className="flex h-fit w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 text-neutral-600 sm:flex-wrap md:flex-nowrap">
                                            <CardHeader className="flex h-fit flex-col gap-3">
                                                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                                                    <StarFour
                                                        size={30}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                    Vsmart Audio
                                                    <p className="text-body">
                                                        (Generate questions by uploading audio
                                                        files)
                                                    </p>
                                                </CardTitle>
                                                <CardDescription className="flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p>
                                                            Convert any lecture, meeting, or audio
                                                            recording into a full question paper.
                                                            Simply upload MP3, WAV, or other audio
                                                            formats — Vsmart Audio transcribes your
                                                            content and uses AI to generate
                                                            structured, context-aware questions. No
                                                            manual transcription or editing
                                                            required. Perfect for language labs,
                                                            podcast-based learning modules,
                                                            corporate training sessions, and
                                                            recorded lectures at universities or
                                                            coaching centers. Trainers and educators
                                                            can repurpose existing audio resources
                                                            into quizzes, comprehension tests, or
                                                            discussion prompts with just a few
                                                            clicks, enhancing engagement and
                                                            reinforcing learning outcomes.
                                                        </p>
                                                    </div>
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                                        <AICenterProvider>
                                            <GenerateQuestionsFromAudio
                                                form={form}
                                                currentSectionIndex={index}
                                            />
                                        </AICenterProvider>
                                    </DialogContent>
                                </Dialog>
                                <Dialog
                                    open={isAIQuestionDialog3}
                                    onOpenChange={setIsAIQuestionDialog3}
                                >
                                    <DialogTrigger>
                                        <Card className="flex h-fit w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 text-neutral-600 sm:flex-wrap md:flex-nowrap">
                                            <CardHeader className="flex h-fit flex-col gap-3">
                                                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                                                    <StarFour
                                                        size={30}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                    Vsmart Topics
                                                    <p className="text-body">
                                                        (Generate questions by providing topics)
                                                    </p>
                                                </CardTitle>
                                                <CardDescription className="flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p>
                                                            Generate custom question papers in
                                                            seconds by just typing a topic, concept,
                                                            or instruction. Vsmart Prompt uses
                                                            advanced AI to understand your input and
                                                            create a tailored set of questions —
                                                            covering various difficulty levels,
                                                            formats, and cognitive skills, all
                                                            aligned to your needs. Perfect for
                                                            teachers, trainers, and academic heads
                                                            who want quick assessments on specific
                                                            topics without uploading any material.
                                                            Whether this is for an impromptu quiz,
                                                            concept revision, or rapid-fire session,
                                                            Vsmart Prompt delivers accurate and
                                                            varied questions with minimal input.
                                                        </p>
                                                    </div>
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                                        <AICenterProvider>
                                            <GenerateQuestionsFromText
                                                form={form}
                                                currentSectionIndex={index}
                                            />
                                        </AICenterProvider>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Extract Questions */}
                    <Dialog open={isAIQuestionDialog8} onOpenChange={setIsAIQuestionDialog8}>
                        <DialogTrigger>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <StarFour weight="fill" className="text-primary-500" />
                                        Extract Questions
                                    </CardTitle>
                                    <CardDescription>
                                        Ask AI to extract questions from any PDF, Image or Audio
                                        Lecture
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        </DialogTrigger>
                        <DialogContent className="no-scrollbar !m-0 flex size-1/2 flex-col !gap-0 !p-0">
                            <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                                Extract Questions
                            </h1>
                            <div className="flex flex-col gap-4 overflow-auto p-4">
                                <Dialog
                                    open={isAIQuestionDialog4}
                                    onOpenChange={setIsAIQuestionDialog4}
                                >
                                    <DialogTrigger>
                                        <Card className="flex h-fit w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 text-neutral-600 sm:flex-wrap md:flex-nowrap">
                                            <CardHeader className="flex h-fit flex-col gap-3">
                                                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                                                    <StarFour
                                                        size={30}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                    Vsmart Extract
                                                    <p className="text-body">
                                                        (Extract questions by uploading pdf, doc and
                                                        ppt files)
                                                    </p>
                                                </CardTitle>
                                                <CardDescription className="flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p>
                                                            Easily extract all existing questions
                                                            from any PDF document — whether it’s a
                                                            past exam paper, a practice worksheet,
                                                            or a question bank. Vsmart Extract scans
                                                            the entire file, identifies question
                                                            patterns, and neatly organizes them for
                                                            easy reuse, editing, or export. Ideal
                                                            for educators and academic teams who
                                                            work with legacy PDFs, shared resources,
                                                            or scanned papers. Save time manually
                                                            copying or retyping questions — Vsmart
                                                            Extract helps schools, coaching centers,
                                                            and corporate training departments
                                                            quickly build digital archives or create
                                                            updated assessments from old materials.
                                                        </p>
                                                    </div>
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                                        <AICenterProvider>
                                            <GenerateAiQuestionPaperComponent
                                                form={form}
                                                currentSectionIndex={index}
                                            />
                                        </AICenterProvider>
                                    </DialogContent>
                                </Dialog>
                                <Dialog
                                    open={isAIQuestionDialog5}
                                    onOpenChange={setIsAIQuestionDialog5}
                                >
                                    <DialogTrigger>
                                        <Card className="flex h-fit w-full cursor-pointer items-center justify-center gap-10 border-neutral-300 bg-neutral-50 text-neutral-600 sm:flex-wrap md:flex-nowrap">
                                            <CardHeader className="flex h-fit flex-col gap-3">
                                                <CardTitle className="flex items-center gap-2 text-title font-semibold">
                                                    <StarFour
                                                        size={30}
                                                        weight="fill"
                                                        className="text-primary-500"
                                                    />
                                                    Vsmart Image
                                                    <p className="text-body">
                                                        (Extract questions by uploading images)
                                                    </p>
                                                </CardTitle>
                                                <CardDescription className="flex flex-col justify-between">
                                                    <div className="flex flex-col gap-3">
                                                        <p>
                                                            Turn images into questions with ease.
                                                            Vsmart Image uses advanced OCR and AI to
                                                            scan photographs, scanned pages,
                                                            handwritten notes, or screenshots — and
                                                            extracts structured questions from them.
                                                            Just upload your image, and let AI do
                                                            the rest. Ideal for teachers, coaching
                                                            institutes, and trainers who often
                                                            receive content in the form of
                                                            handwritten notes, textbook snapshots,
                                                            or board images. Whether you are
                                                            digitizing old test papers or pulling
                                                            questions from printed material — Vsmart
                                                            Image brings analog content into your
                                                            digital workflow in seconds.
                                                        </p>
                                                    </div>
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                    </DialogTrigger>
                                    <DialogContent className="no-scrollbar !m-0 flex h-full !w-full !max-w-full flex-col !gap-0 overflow-y-auto !rounded-none !p-0">
                                        <AICenterProvider>
                                            <GenerateAiQuestionFromImageComponent
                                                form={form}
                                                currentSectionIndex={index}
                                            />
                                        </AICenterProvider>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default Step2GenerateQuestionsFromAIHomework;
