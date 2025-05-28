import { MyDialog } from "@/components/design-system/dialog";
import { QuestionsFromTextData } from "../../ai-tools/vsmart-prompt/-components/GenerateQuestionsFromText";
import { MyButton } from "@/components/design-system/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AITaskIndividualListInterface } from "@/types/ai/generate-assessment/generate-complete-assessment";

const formSchema = z.object({
    taskName: z.string().min(1),
    text: z.string().min(1),
    num: z.number().min(1),
    class_level: z.string().min(1),
    topics: z.string().min(1),
    question_type: z.string().min(1),
    question_language: z.string().min(1),
});

export const VsmartPrompt = ({
    open,
    handleOpen,
    pollGenerateQuestionsFromText,
    // task
}: {
    open: boolean;
    handleOpen: (open: boolean) => void;
    pollGenerateQuestionsFromText?: (data: QuestionsFromTextData) => void;
    task: AITaskIndividualListInterface;
}) => {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<QuestionsFromTextData>({
        resolver: zodResolver(formSchema),
    });

    const onSubmit = (data: QuestionsFromTextData) => {
        pollGenerateQuestionsFromText?.(data);
        handleOpen(false);
    };

    const footer = (
        <div className="flex items-center justify-end gap-2">
            <MyButton
                type="button"
                scale="small"
                buttonType="secondary"
                onClick={() => handleOpen(false)}
            >
                Cancel
            </MyButton>
            <MyButton type="submit" scale="small" buttonType="primary">
                Regenerate
            </MyButton>
        </div>
    );

    return (
        <MyDialog heading="Vsmart Prompt" open={open} onOpenChange={handleOpen}>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label htmlFor="taskName" className="text-sm font-medium">
                        Task Name
                    </label>
                    <input
                        id="taskName"
                        {...register("taskName")}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter task name"
                    />
                    {errors.taskName && (
                        <span className="text-sm text-red-500">{errors.taskName.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="text" className="text-sm font-medium">
                        Text
                    </label>
                    <textarea
                        id="text"
                        {...register("text")}
                        className="h-32 w-full resize-none rounded-md border p-2"
                        placeholder="Enter text"
                    />
                    {errors.text && (
                        <span className="text-sm text-red-500">{errors.text.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="num" className="text-sm font-medium">
                        Number of Questions
                    </label>
                    <input
                        id="num"
                        type="number"
                        {...register("num", { valueAsNumber: true })}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter number of questions"
                    />
                    {errors.num && (
                        <span className="text-sm text-red-500">{errors.num.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="class_level" className="text-sm font-medium">
                        Class Level
                    </label>
                    <input
                        id="class_level"
                        {...register("class_level")}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter class level"
                    />
                    {errors.class_level && (
                        <span className="text-sm text-red-500">{errors.class_level.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="topics" className="text-sm font-medium">
                        Topics
                    </label>
                    <input
                        id="topics"
                        {...register("topics")}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter topics"
                    />
                    {errors.topics && (
                        <span className="text-sm text-red-500">{errors.topics.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="question_type" className="text-sm font-medium">
                        Question Type
                    </label>
                    <input
                        id="question_type"
                        {...register("question_type")}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter question type"
                    />
                    {errors.question_type && (
                        <span className="text-sm text-red-500">{errors.question_type.message}</span>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="question_language" className="text-sm font-medium">
                        Question Language
                    </label>
                    <input
                        id="question_language"
                        {...register("question_language")}
                        className="w-full rounded-md border p-2"
                        placeholder="Enter question language"
                    />
                    {errors.question_language && (
                        <span className="text-sm text-red-500">
                            {errors.question_language.message}
                        </span>
                    )}
                </div>

                {footer}
            </form>
        </MyDialog>
    );
};

export default VsmartPrompt;
