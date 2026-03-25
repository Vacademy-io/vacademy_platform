import { useState, useMemo } from 'react';
import { Check, Copy } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MyButton } from '@/components/design-system/button';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { cn } from '@/lib/utils';
import createCampaignLink from '../../-utils/createCampaignLink';

interface CampaignLinkProps {
    campaignId?: string;
    presetLink?: string;
    label?: string;
    className?: string;
}

const CampaignLink: React.FC<CampaignLinkProps> = ({
    campaignId,
    presetLink,
    label,
    className,
}) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const [copySuccess, setCopySuccess] = useState(false);

    const shareableLink = useMemo(() => {
        if (presetLink) return presetLink;
        if (!campaignId) return '';
        return createCampaignLink(campaignId, instituteDetails?.learner_portal_base_url);
    }, [campaignId, presetLink, instituteDetails?.learner_portal_base_url]);

    if (!shareableLink) {
        return null;
    }

    const handleCopy = () => {
        navigator.clipboard
            .writeText(shareableLink)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch((error) => {
                console.error('Unable to copy campaign link', error);
            });
    };

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {label && <span className="text-sm font-semibold text-neutral-700">{label}</span>}
            <div className="flex flex-wrap items-center gap-3 text-sm">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <a
                                href={shareableLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate text-neutral-600 underline decoration-dotted hover:text-primary-600"
                            >
                                {shareableLink}
                            </a>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs break-all">
                            <a
                                href={shareableLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600"
                            >
                                {shareableLink}
                            </a>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <div className="flex items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        layoutVariant="icon"
                        scale="medium"
                        onClick={handleCopy}
                        aria-label="Copy campaign link"
                    >
                        <Copy />
                    </MyButton>
                    {copySuccess && (
                        <span className="text-primary-500" aria-live="polite">
                            <Check />
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CampaignLink;

