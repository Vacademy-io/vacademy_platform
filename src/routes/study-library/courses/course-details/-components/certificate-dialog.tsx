import { GraduationCap } from "phosphor-react";
import { toTitleCase } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MyButton } from "@/components/design-system/button";

interface CertificateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    certificateUrl: string | null;
    courseTitle: string;
    sessionLabel?: string;
    levelLabel?: string;
}

export const CertificateDialog = ({
    open,
    onOpenChange,
    certificateUrl,
    courseTitle,
    sessionLabel,
    levelLabel,
}: CertificateDialogProps) => {
    const isSessionVisible = !!sessionLabel && sessionLabel.toLowerCase() !== "default";
    const isLevelVisible = !!levelLabel && levelLabel.toLowerCase() !== "default";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-5 py-4 flex items-center gap-3"
                    style={{
                        background:
                            "linear-gradient(to right, var(--color-primary-600, #2563eb), var(--color-primary-500, #3b82f6))",
                        color: "#fff",
                    }}
                >
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <GraduationCap size={18} className="text-white" />
                    </div>
                    <div>
                        <div className="text-base font-semibold">Course Completed</div>
                        <div className="text-xs opacity-90">
                            Congratulations! You've earned a certificate.
                        </div>
                    </div>
                </div>
                <div className="px-5 py-4">
                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Course:</span>
                            <span className="ml-2">{toTitleCase(courseTitle)}</span>
                        </div>
                        {isSessionVisible && (
                            <div>
                                <span className="font-medium text-gray-700">Session:</span>
                                <span className="ml-2">{toTitleCase(sessionLabel || "")}</span>
                            </div>
                        )}
                        {isLevelVisible && (
                            <div>
                                <span className="font-medium text-gray-700">Level:</span>
                                <span className="ml-2">{toTitleCase(levelLabel || "")}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 -mx-5 px-5 py-3 bg-gray-50 dark:bg-neutral-900/50 border-t border-gray-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => onOpenChange(false)}
                        >
                            Close
                        </MyButton>
                        <MyButton asChild buttonType="primary" scale="medium">
                            <a
                                href={certificateUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => onOpenChange(false)}
                            >
                                View Certificate
                            </a>
                        </MyButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
