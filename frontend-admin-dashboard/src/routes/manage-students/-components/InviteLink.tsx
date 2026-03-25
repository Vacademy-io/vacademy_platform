import { Check, Copy } from '@phosphor-icons/react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import createInviteLink from '../invite/-utils/createInviteLink';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useState } from 'react';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const InviteLink = ({ inviteCode }: { inviteCode: string }) => {
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const { instituteDetails } = useInstituteDetailsStore();
    const inviteLink = createInviteLink(inviteCode, instituteDetails?.learner_portal_base_url);
    const handleCopyClick = (link: string) => {
        navigator.clipboard
            .writeText(link)
            .then(() => {
                setCopySuccess(link);
                setTimeout(() => {
                    setCopySuccess(null);
                }, 2000);
            })
            .catch((err) => {
                console.log('Failed to copy link: ', err);
                toast.error('Copy failed');
            });
    };
    return (
        <div className="flex items-center gap-4">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <a
                            href={inviteLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-body text-neutral-600 underline hover:text-primary-500"
                        >
                            {`${inviteLink}`}
                        </a>
                    </TooltipTrigger>
                    <TooltipContent className="cursor-pointer border border-neutral-300 bg-neutral-50 text-neutral-600 hover:text-primary-500">
                        <a href={inviteLink} target="_blank" rel="noopener noreferrer">
                            {inviteLink}
                        </a>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="icon"
                    onClick={() => handleCopyClick(inviteLink)}
                >
                    <Copy />
                </MyButton>
                {copySuccess == inviteLink && (
                    <div className="text-primary-500">
                        <Check />
                    </div>
                )}
            </div>
        </div>
    );
};
