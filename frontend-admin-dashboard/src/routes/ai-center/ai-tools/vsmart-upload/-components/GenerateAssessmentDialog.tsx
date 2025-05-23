import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MyButton } from '@/components/design-system/button';
import { DashboardLoader } from '@/components/core/dashboard-loader';

interface GenerateDialogProps {
    open: boolean;
    handleOpen: (open: boolean) => void;
    handleGenerateCompleteFile: () => void;
    handleGeneratePageWise: () => void;
    allPagesGenerateQuestionsStatus: boolean;
    pageWiseGenerateQuestionsStatus: boolean;
}

export const GenerateAssessmentDialog = ({
    open,
    handleOpen,
    handleGenerateCompleteFile,
    handleGeneratePageWise,
    allPagesGenerateQuestionsStatus,
    pageWiseGenerateQuestionsStatus,
}: GenerateDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogContent className="p-0">
                <h1 className="rounded-t-lg bg-primary-50 p-4 font-semibold text-primary-500">
                    Generate Assessment
                </h1>
                <div className="my-4 flex flex-col items-center justify-center gap-4">
                    <MyButton
                        type="submit"
                        scale="medium"
                        buttonType="secondary"
                        layoutVariant="default"
                        className="text-sm"
                        onClick={handleGenerateCompleteFile}
                    >
                        {allPagesGenerateQuestionsStatus ? (
                            <DashboardLoader size={18} />
                        ) : (
                            'Select Questions From All Pages'
                        )}
                    </MyButton>
                    <MyButton
                        type="submit"
                        scale="medium"
                        buttonType="secondary"
                        layoutVariant="default"
                        className="text-sm"
                        onClick={handleGeneratePageWise}
                    >
                        {pageWiseGenerateQuestionsStatus ? (
                            <DashboardLoader size={18} />
                        ) : (
                            'Select Question From Specific Pages'
                        )}
                    </MyButton>
                </div>
            </DialogContent>
        </Dialog>
    );
};
