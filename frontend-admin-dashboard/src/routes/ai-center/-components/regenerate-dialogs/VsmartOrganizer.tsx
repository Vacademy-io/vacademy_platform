import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { useState } from "react";
import { AITaskIndividualListInterface } from "@/types/ai/generate-assessment/generate-complete-assessment";

export const VsmartOrganizer = ({
    open,
    handleOpen,
    pollGenerateAssessment,
    task,
}: {
    open: boolean;
    handleOpen: (open: boolean) => void;
    pollGenerateAssessment?: (
        pdfId: string,
        prompt: string,
        taskName: string,
        taskId: string,
    ) => void;
    task: AITaskIndividualListInterface;
}) => {
    const [prompt, setPrompt] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        pollGenerateAssessment && pollGenerateAssessment("", prompt, task.task_name, task.id);
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
            <MyButton type="submit" scale="small" buttonType="primary" onClick={handleSubmit}>
                Regenerate
            </MyButton>
        </div>
    );

    return (
        <MyDialog heading="Vsmart Organizer" open={open} onOpenChange={handleOpen}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <label htmlFor="prompt" className="text-sm font-medium">
                        Enter your prompt
                    </label>
                    <textarea
                        id="prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="h-32 w-full resize-none rounded-md border p-2"
                        placeholder="Enter your prompt here..."
                    />
                </div>
                {footer}
            </form>
        </MyDialog>
    );
};
