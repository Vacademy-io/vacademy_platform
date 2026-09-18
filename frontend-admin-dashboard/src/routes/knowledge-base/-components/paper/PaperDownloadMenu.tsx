import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CaretDown, DownloadSimple, Key, Spinner } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PaperPdfOptions } from '../../-services/paper-service';

interface PaperDownloadMenuProps {
    /** Performs the download; the menu only decides which variant. */
    onDownload: (options: PaperPdfOptions) => Promise<void>;
    disabled?: boolean;
    scale?: 'small' | 'medium';
    buttonType?: 'secondary' | 'text';
    className?: string;
}

/**
 * "Download PDF" with the two things a teacher actually prints: the paper on
 * its own for the class, and the paper followed by the answer key for
 * themselves. One button rather than two so the row of actions stays short.
 *
 * The menu shows a spinner and locks while the server lays the paper out —
 * a second click mid-render would otherwise queue a second browser.
 */
export const PaperDownloadMenu = ({
    onDownload,
    disabled = false,
    scale = 'medium',
    buttonType = 'secondary',
    className,
}: PaperDownloadMenuProps) => {
    const { t } = useTranslation('knowledgeBasePaperDownload');
    const [busy, setBusy] = useState(false);

    const run = async (options: PaperPdfOptions) => {
        setBusy(true);
        try {
            await onDownload(options);
        } catch {
            toast.error(t('failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <MyButton
                    type="button"
                    buttonType={buttonType}
                    scale={scale}
                    disable={disabled || busy}
                    className={className}
                    aria-label={t('button')}
                >
                    {busy ? (
                        <Spinner className="mr-1 size-4 animate-spin" />
                    ) : (
                        <DownloadSimple className="mr-1 size-4" />
                    )}
                    {busy ? t('preparing') : t('button')}
                    {!busy && <CaretDown className="ml-1 size-3.5" />}
                </MyButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={busy} onClick={() => run({ includeAnswerKey: false })}>
                    <DownloadSimple className="me-2 size-4" />
                    {t('questionPaper')}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={busy} onClick={() => run({ includeAnswerKey: true })}>
                    <Key className="me-2 size-4" />
                    {t('withAnswerKey')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
