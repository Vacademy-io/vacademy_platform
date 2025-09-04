import { GraduationCap } from "phosphor-react";

interface CertificateCardProps {
    certificateUrl: string | null;
}

export const CertificateCard = ({ certificateUrl }: CertificateCardProps) => {
    if (!certificateUrl) return null;

    return (
        <div
            className="relative bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-all duration-200 p-3 sm:p-4 group animate-fade-in-up"
            style={{ animationDelay: "0.05s" }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
            <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-md shadow-sm">
                        <GraduationCap
                            size={18}
                            className="text-emerald-600"
                            weight="duotone"
                        />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-900">
                            Certificate available
                        </div>
                        <div className="text-xs text-gray-600">
                            You can view or download your certificate now.
                        </div>
                    </div>
                </div>
                <a
                    href={certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 rounded-md text-xs font-medium shadow"
                >
                    View Certificate
                </a>
            </div>
        </div>
    );
};
