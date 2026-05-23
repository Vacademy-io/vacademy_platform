import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GraduationCap, Download, Eye, X, ArrowsClockwise } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";

interface CertificateCompletionBannerProps {
    certificateUrl: string | null;
    courseTitle: string;
    sessionLabel?: string;
    levelLabel?: string;
    percentageCompleted: number;
    threshold: number;
    /**
     * Re-issue the certificate against the current template (bypasses both
     * the backend's cached file id and the local-storage cache). Receives
     * the course title currently shown in the modal so the regenerated PDF's
     * COURSE_NAME field matches what the learner sees — without relying on
     * form-state lookups that might return undefined at call time.
     * Optional — when omitted, the Refresh button is hidden.
     */
    onRegenerate?: (courseTitle: string) => Promise<string | null> | string | null;
}

export const CertificateCompletionBanner = ({
    certificateUrl,
    courseTitle,
    // sessionLabel,
    // levelLabel,
    percentageCompleted,
    threshold,
    onRegenerate,
}: CertificateCompletionBannerProps) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [currentUrl, setCurrentUrl] = useState<string | null>(certificateUrl);
    const [isRefreshing, setIsRefreshing] = useState(false);
    useEffect(() => {
        setCurrentUrl(certificateUrl);
    }, [certificateUrl]);

    const handleRefresh = async () => {
        if (!onRegenerate || isRefreshing) return;
        try {
            setIsRefreshing(true);
            // Pass the title the modal is currently displaying so the
            // regenerated PDF uses the same value the learner can see.
            const fresh = await onRegenerate(courseTitle);
            if (fresh) setCurrentUrl(fresh);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Close preview on Escape and lock background scroll while open.
    useEffect(() => {
        if (!previewOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPreviewOpen(false);
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [previewOpen]);

    // Only show if percentage completed meets or exceeds threshold
    if (percentageCompleted < threshold || !currentUrl) {
        return null;
    }

    // Use Google Docs viewer as a fallback so storage URLs that return
    // Content-Disposition: attachment still preview inline instead of
    // triggering a download.
    const previewSrc = `https://docs.google.com/viewer?url=${encodeURIComponent(
        currentUrl
    )}&embedded=true`;

    return (
        <>
            <div className={cn(
                "mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm animate-fade-in-up",
                // Vibrant Styles - Flat Pastel
                "[.ui-vibrant_&]:bg-emerald-50/50 dark:[.ui-vibrant_&]:bg-emerald-950/20",
                "[.ui-vibrant_&]:border-emerald-200/50 dark:[.ui-vibrant_&]:border-emerald-800/30 [.ui-vibrant_&]:shadow-sm",
                // Play Styles — solid green, bold, Duolingo-style
                "[.ui-play_&]:bg-[#58cc02] [.ui-play_&]:border-[#46a302] [.ui-play_&]:text-white [.ui-play_&]:rounded-2xl [.ui-play_&]:font-extrabold",
                "[.ui-play_&]:shadow-[0_4px_0_#46a302]"
            )}>
                <div className="flex items-center gap-4">
                    {/* Left Side - Certificate Icon and Content */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Certificate Icon */}
                        <div className={cn(
                            "flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg",
                            // Vibrant Styles - Flat Icon
                            "[.ui-vibrant_&]:bg-none [.ui-vibrant_&]:bg-emerald-600 [.ui-vibrant_&]:shadow-md",
                            // Play Styles
                            "[.ui-play_&]:bg-white [.ui-play_&]:text-[#58cc02] [.ui-play_&]:shadow-[0_3px_0_#d4d4d4] [.ui-play_&]:rounded-xl"
                        )}>
                            <GraduationCap size={20} className="text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold text-black dark:text-white">
                                    🎉 Course Completed!
                                </h3>
                                {/* <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    percentageCompleted === 100 
                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white dark:text-white' 
                                        : 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300'
                                }`}>
                                    {percentageCompleted}% Complete
                                </div> */}
                            </div>

                            <p className="text-black dark:text-gray-300 text-sm">
                                Congratulations! You've earned a certificate.
                            </p>
                        </div>
                    </div>

                    {/* Right Side - Action Buttons */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col gap-2">
                            <MyButton
                                buttonType="primary"
                                scale="small"
                                className="flex items-center gap-2 w-full text-xs"
                                onClick={() => setPreviewOpen(true)}
                            >
                                <Eye size={14} />
                                View Certificate
                            </MyButton>

                            <MyButton
                                asChild
                                buttonType="secondary"
                                scale="small"
                                className="flex items-center gap-2 w-full text-xs"
                            >
                                <a
                                    href={currentUrl}
                                    download={`${courseTitle}_Certificate.pdf`}
                                >
                                    <Download size={14} />
                                    Download Certificate
                                </a>
                            </MyButton>
                        </div>
                    </div>
                </div>
            </div>

            {previewOpen &&
                createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Certificate preview"
                        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"
                        onClick={() => setPreviewOpen(false)}
                    >
                        <div
                            className="relative w-[95vw] max-w-5xl h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 pr-24">
                                <GraduationCap size={18} className="text-emerald-600 flex-shrink-0" />
                                <span className="text-sm font-medium truncate">
                                    {courseTitle} — Certificate Preview
                                </span>
                            </div>
                            {onRegenerate && (
                                <button
                                    type="button"
                                    aria-label="Refresh certificate"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    title="Re-issue with the latest template"
                                    className="absolute right-12 top-3 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <ArrowsClockwise
                                        size={14}
                                        className={isRefreshing ? "animate-spin" : ""}
                                    />
                                    {isRefreshing ? "Refreshing" : "Refresh"}
                                </button>
                            )}
                            <button
                                type="button"
                                aria-label="Close preview"
                                onClick={() => setPreviewOpen(false)}
                                className="absolute right-3 top-3 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            >
                                <X size={18} />
                            </button>
                            <iframe
                                title="Certificate Preview"
                                src={previewSrc}
                                className="flex-1 w-full bg-gray-100 dark:bg-gray-900"
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};
