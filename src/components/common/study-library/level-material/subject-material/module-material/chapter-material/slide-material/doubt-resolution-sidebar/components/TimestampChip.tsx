
import { Clock, FileText, PencilSimple } from "@phosphor-icons/react";
import { useContentStore } from "@/stores/study-library/chapter-sidebar-store";

interface TimestampChipProps {
    timestamp: number;
    formattedTime: string;
    onEdit: () => void;
}

export const TimestampChip = ({ formattedTime, onEdit }: TimestampChipProps) => {
    const { activeItem } = useContentStore();
    const isDocument = activeItem?.source_type === "DOCUMENT";

    return (
        <div 
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200/60 text-primary-700 rounded-xl cursor-pointer hover:shadow-md hover:border-primary-300 transition-all duration-200 group"
        >
            <div className="flex items-center gap-1.5">
                {isDocument ? (
                    <FileText size={14} className="text-primary-600" />
                ) : (
                    <Clock size={14} className="text-primary-600" />
                )}
                <span className="text-sm font-semibold">{formattedTime}</span>
            </div>
            <PencilSimple 
                size={12} 
                className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" 
            />
        </div>
    );
}; 