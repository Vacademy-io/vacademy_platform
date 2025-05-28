import { Check, Copy } from 'phosphor-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import createInviteLink from '../invite/-utils/createInviteLink';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useState } from 'react';

export const InviteLink = ({ inviteCode, linkLen }: { inviteCode: string; linkLen?: number }) => {
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
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
        <>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <a
                            href={createInviteLink(inviteCode)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-body text-neutral-600 underline hover:text-primary-500"
                        >
                            {`${createInviteLink(inviteCode).slice(0, linkLen || 32)}..`}
                        </a>
                    </TooltipTrigger>
                    <TooltipContent className="cursor-pointer border border-neutral-300 bg-neutral-50 text-neutral-600 hover:text-primary-500">
                        <a
                            href={createInviteLink(inviteCode)}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {createInviteLink(inviteCode)}
                        </a>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-2">
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="icon"
                    onClick={() => handleCopyClick(createInviteLink(inviteCode))}
                >
                    <Copy />
                </MyButton>
                {copySuccess == createInviteLink(inviteCode) && (
                    <div className="text-primary-500">
                        <Check />
                    </div>
                )}
            </div>
        </>
    );
};
