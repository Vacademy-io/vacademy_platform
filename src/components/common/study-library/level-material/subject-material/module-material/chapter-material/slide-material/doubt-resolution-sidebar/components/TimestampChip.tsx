import { Badge } from "@/components/ui/badge";
import { Clock, FileText } from "@phosphor-icons/react";
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
        <Badge 
            variant="outline" 
            className="flex items-center gap-1 px-2 py-1 bg-primary-50 border-primary-200 text-primary-700 cursor-pointer hover:bg-primary-100 transition-colors"
            onClick={onEdit}
        >
            {isDocument ? (
                <FileText className="w-3 h-3" />
            ) : (
                <Clock className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">{formattedTime}</span>
        </Badge>
    );
}; 