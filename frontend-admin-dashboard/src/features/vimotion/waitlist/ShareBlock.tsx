import { useState } from 'react';
import { Copy, Check, TwitterLogo, WhatsappLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ShareBlockProps {
    referralCode: string;
}

function buildShareUrl(referralCode: string): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/vim/waitlist?ref=${encodeURIComponent(referralCode)}`;
}

const SHARE_TEXT =
    'I just joined the Vimotion waitlist — AI-powered video for studios. Use my link to skip the line:';

export function ShareBlock({ referralCode }: ShareBlockProps) {
    const [copied, setCopied] = useState(false);
    const shareUrl = buildShareUrl(referralCode);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Link copied');
        } catch {
            toast.error('Could not copy — long-press the field to copy manually.');
        }
    };

    const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `${SHARE_TEXT} ${shareUrl}`
    )}`;
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${shareUrl}`)}`;

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <Input
                    readOnly
                    value={shareUrl}
                    className="h-11 font-mono text-sm"
                    onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                />
                <Button
                    type="button"
                    onClick={handleCopy}
                    className="h-11 shrink-0 gap-2 bg-neutral-900 px-4 text-white hover:bg-neutral-800"
                >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            <div className="flex gap-2">
                <a
                    href={twitterHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                    <TwitterLogo className="size-4" weight="fill" />
                    Share on X
                </a>
                <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                    <WhatsappLogo className="size-4" weight="fill" />
                    WhatsApp
                </a>
            </div>
        </div>
    );
}
