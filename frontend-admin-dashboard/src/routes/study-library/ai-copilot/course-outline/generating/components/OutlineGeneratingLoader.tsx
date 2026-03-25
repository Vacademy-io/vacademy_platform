import { BrainCircuit, FileText, Layers, Sparkles, CheckCircle } from 'lucide-react';
import { AiGeneratingLoader } from '@/components/common/slides/AiGeneratingLoader';
import { getTerminologyPlural } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getAiProductName } from '@/config/branding';

const outlineSteps = [
    { text: 'Analyzing your topic...', icon: BrainCircuit },
    { text: 'Structuring the outline...', icon: FileText },
    { text: `Organizing ${getTerminologyPlural(ContentTerms.Chapters, SystemTerms.Chapters).toLowerCase()} and topics...`, icon: Layers },
    { text: 'Creating learning objectives...', icon: Sparkles },
    { text: 'Finalizing your outline...', icon: CheckCircle },
];

interface OutlineGeneratingLoaderProps {
    estimatedTimeRemaining?: number;
}

export const OutlineGeneratingLoader = ({ estimatedTimeRemaining }: OutlineGeneratingLoaderProps) => {
    const aiName = getAiProductName();
    const hasTimeLeft = estimatedTimeRemaining != null && estimatedTimeRemaining > 0;
    const minutes = hasTimeLeft ? Math.floor(estimatedTimeRemaining! / 60) : 0;
    const seconds = hasTimeLeft ? estimatedTimeRemaining! % 60 : 0;

    const getDescription = () => {
        if (hasTimeLeft) {
            return `Estimated time: ${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
        }
        if (estimatedTimeRemaining != null && estimatedTimeRemaining <= 0) {
            return 'Still working — almost there...';
        }
        return `${aiName} is crafting your course structure. This may take a moment.`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-purple-50">
            <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
                <AiGeneratingLoader
                    title={`${aiName} is generating your outline`}
                    description={getDescription()}
                    steps={outlineSteps}
                />
            </div>
        </div>
    );
};
