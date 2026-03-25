import { Button } from '@/components/ui/button';
import { DownloadSimple } from '@phosphor-icons/react';

interface DownloadButtonProps {
    onClick: () => void;
    label?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg';
    disabled?: boolean;
}

export const DownloadButton = ({
    onClick,
    label = 'Download PDF',
    variant = 'outline',
    size = 'sm',
    disabled = false,
}: DownloadButtonProps) => {
    return (
        <Button
            onClick={onClick}
            variant={variant}
            size={size}
            className="gap-2"
            disabled={disabled}
        >
            <DownloadSimple size={16} />
            {label}
        </Button>
    );
};
