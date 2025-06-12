import {
    ExportSettingsProvider,
    useExportSettings,
} from "@/components/common/export-offline/contexts/export-settings-context";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Trash2 } from "lucide-react";
import { ArrowSquareOut, Upload } from "phosphor-react";
import { PaperSetQuestions } from "./PaperSetQuestions";
import { ExportHandlerQuestionPaper } from "./ExportHandlerQuestionPaper";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ExportQuestionPaperSettingsDialog } from "./export-question-paper-dialog/export-question-paper-setting-dialog";
import { useSuspenseQuery } from "@tanstack/react-query";
import { handleGetQuestionPaperById } from "../../-utils/question-paper-services";
import { convertQuestionsToExportSchema } from "../../-utils/helper";
import { DashboardLoader } from "@/components/core/dashboard-loader";

const ExportQuestionPaper = ({ questionPaperId }: { questionPaperId: string }) => {
    return (
        <Dialog>
            <DialogTrigger>
                <ArrowSquareOut />
            </DialogTrigger>
            <DialogContent className="no-scrollbar !m-0 h-full !w-full !max-w-full !gap-0 overflow-y-auto !rounded-none !p-0">
                <ExportSettingsProvider>
                    <PreviewWithSettings questionPaperId={questionPaperId} />
                </ExportSettingsProvider>
            </DialogContent>
        </Dialog>
    );
};

function PreviewWithSettings({ questionPaperId }: { questionPaperId: string }) {
    const { data: questionsData, isLoading } = useSuspenseQuery(
        handleGetQuestionPaperById(questionPaperId),
    );

    // @ts-expect-error : Object is possibly 'undefined'
    const convertedQuestions: Question[] = convertQuestionsToExportSchema(
        questionsData.question_dtolist,
    );
    const [showSettings, setShowSettings] = useState(false);
    const { settings, updateSettings } = useExportSettings();

    // Determine padding based on settings
    // const getPadding = () => {
    //     switch (settings.pagePadding) {
    //         case "low":
    //             return "10mm";
    //         case "high":
    //             return "30mm";
    //         default:
    //             return "20mm"; // medium
    //     }
    // };

    const handleLetterheadUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const imageDataUrl = reader.result as string;
                updateSettings({
                    customLetterheadImage: imageDataUrl,
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteLetterhead = () => {
        updateSettings({
            customLetterheadImage: undefined,
        });
    };

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="min-h-screen w-full bg-slate-50/50" style={{ boxSizing: "border-box" }}>
            <div className="no-print sticky top-0 z-10 border-b bg-white">
                <div className="flex items-center justify-between p-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowSettings(true)}
                        className="gap-2"
                    >
                        <Settings className="size-4" />
                        Export Settings
                    </Button>
                    <div className="flex items-center gap-4">
                        <input
                            type="file"
                            id="letterhead-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLetterheadUpload}
                        />
                        {settings.showInstitutionLetterhead && (
                            <div className="flex items-center gap-2">
                                <DialogClose>
                                    <Button variant="outline" className="mr-2">
                                        Close
                                    </Button>
                                </DialogClose>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        document.getElementById("letterhead-upload")?.click()
                                    }
                                >
                                    <Upload />
                                    Letterhead
                                </Button>
                                {settings.customLetterheadImage && (
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={handleDeleteLetterhead}
                                        title="Delete Letterhead"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                        <ExportHandlerQuestionPaper
                            questionPaperId={questionPaperId}
                            settings={settings}
                        />
                    </div>
                </div>
            </div>

            {showSettings && (
                <ExportQuestionPaperSettingsDialog
                    open={showSettings}
                    onOpenChange={setShowSettings}
                    questionsData={convertedQuestions}
                />
            )}

            <div className="container mx-auto py-4">
                <PaperSetQuestions questionPaperId={questionPaperId} settings={settings} />
            </div>
        </div>
    );
}

export default ExportQuestionPaper;
