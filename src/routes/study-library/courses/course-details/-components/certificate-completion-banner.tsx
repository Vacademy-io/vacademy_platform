import { GraduationCap, Download, Eye } from "phosphor-react";
import { toTitleCase } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";

interface CertificateCompletionBannerProps {
    certificateUrl: string | null;
    courseTitle: string;
    sessionLabel?: string;
    levelLabel?: string;
    percentageCompleted: number;
    threshold: number;
}

export const CertificateCompletionBanner = ({
    certificateUrl,
    courseTitle,
    sessionLabel,
    levelLabel,
    percentageCompleted,
    threshold,
}: CertificateCompletionBannerProps) => {
    // Only show if percentage completed meets or exceeds threshold
    if (percentageCompleted < threshold || !certificateUrl) {
        return null;
    }

    return (
        <>
            <div className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm animate-fade-in-up">
                <div className="flex items-center gap-4">
                    {/* Left Side - Certificate Icon and Content */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Certificate Icon */}
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                            <GraduationCap size={20} className="text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold text-black dark:text-white">
                                    🎉 Course Completed!
                                </h3>
                                <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    percentageCompleted === 100 
                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white dark:text-white' 
                                        : 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300'
                                }`}>
                                    {percentageCompleted}% Complete
                                </div>
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
                                asChild
                                buttonType="primary"
                                scale="small"
                                className="flex items-center gap-2 w-full text-xs"
                            >
                                <a
                                    href={certificateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Eye size={14} />
                                    View Certificate
                                </a>
                            </MyButton>
                            
                            <MyButton
                                asChild
                                buttonType="secondary"
                                scale="small"
                                className="flex items-center gap-2 w-full text-xs"
                            >
                                <a
                                    href={certificateUrl}
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
        </>
    );
};
