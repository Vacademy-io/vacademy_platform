import { Badge } from '@/components/ui/badge';
import { Sparkle, PencilSimple, FileText, Plus, Info } from '@phosphor-icons/react';
import { CriteriaSource } from '../../../-services/criteria-services';

interface CriteriaStatusBadgeProps {
    status: CriteriaSource | 'not-added';
    onClick: () => void;
    onPreview?: () => void;
    className?: string;
}

export const CriteriaStatusBadge = ({
    status,
    onClick,
    onPreview,
    className = '',
}: CriteriaStatusBadgeProps) => {
    const getBadgeConfig = () => {
        switch (status) {
            case 'ai':
                return {
                    icon: <Sparkle size={14} weight="fill" />,
                    label: 'AI Generated',
                    bgClass: 'bg-blue-50 border-blue-200',
                    textClass: 'text-blue-700',
                };
            case 'manual':
                return {
                    icon: <PencilSimple size={14} weight="bold" />,
                    label: 'Manual',
                    bgClass: 'bg-purple-50 border-purple-200',
                    textClass: 'text-purple-700',
                };
            case 'template':
                return {
                    icon: <FileText size={14} weight="fill" />,
                    label: 'Template',
                    bgClass: 'bg-green-50 border-green-200',
                    textClass: 'text-green-700',
                };
            case 'not-added':
            default:
                return {
                    icon: <Plus size={14} weight="bold" />,
                    label: 'Not Added',
                    bgClass: 'bg-gray-50 border-gray-300',
                    textClass: 'text-gray-600',
                };
        }
    };

    const config = getBadgeConfig();
    const hasPreview = onPreview && status !== 'not-added';

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <button
                type="button"
                onClick={onClick}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-all hover:opacity-80 hover:shadow-sm ${config.bgClass} ${config.textClass}`}
            >
                {config.icon}
                <span className="text-xs font-medium">{config.label}</span>
            </button>
            {hasPreview && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview();
                    }}
                    className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-neutral-100"
                    title="Preview criteria"
                >
                    <Info size={16} className="text-neutral-600" />
                </button>
            )}
        </div>
    );
};
