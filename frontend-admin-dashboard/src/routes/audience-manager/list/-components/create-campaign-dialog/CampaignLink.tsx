import { useState, useMemo } from 'react';
import { Check, Copy, Link as LinkIcon } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
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
        <div className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
            {label && (
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {label}
                </span>
            )}
            <div className="group flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50/60 transition-colors focus-within:border-primary-300 focus-within:bg-white hover:border-neutral-300">
                <div className="flex shrink-0 items-center pl-3 pr-2 text-neutral-400">
                    <LinkIcon size={16} weight="bold" />
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <a
                                href={shareableLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={shareableLink}
                                className="min-w-0 flex-1 truncate py-2 pr-3 font-mono text-xs text-neutral-700 hover:text-primary-600 sm:text-[13px]"
                            >
                                {shareableLink}
                            </a>
                        </TooltipTrigger>
                        <TooltipContent
                            side="top"
                            className="max-w-[min(90vw,28rem)] break-all"
                        >
                            {shareableLink}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    aria-label={copySuccess ? 'Copied' : 'Copy link'}
                    className="shrink-0 rounded-none border-l border-neutral-200 px-3 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                    {copySuccess ? (
                        <span className="flex items-center gap-1.5 text-success-600">
                            <Check size={14} weight="bold" />
                            <span className="text-xs font-medium">Copied</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <Copy size={14} weight="bold" />
                            <span className="hidden text-xs font-medium sm:inline">Copy</span>
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default CampaignLink;
