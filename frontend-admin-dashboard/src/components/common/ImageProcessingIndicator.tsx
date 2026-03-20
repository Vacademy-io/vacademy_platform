import React from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageProcessingIndicatorProps {
    isProcessing: boolean;
    imageCount?: number;
    className?: string;
}

export const ImageProcessingIndicator: React.FC<ImageProcessingIndicatorProps> = ({
    isProcessing,
    imageCount = 0,
    className = '',
}) => {
    if (!isProcessing) return null;

    return (
        <div className={`flex items-center gap-2 text-sm text-blue-600 ${className}`}>
            <Loader2 className="size-4 animate-spin" />
            <ImageIcon className="size-4" />
            <span>
                Processing {imageCount > 0 ? `${imageCount} ` : ''}image
                {imageCount !== 1 ? 's' : ''}...
            </span>
        </div>
    );
};

export default ImageProcessingIndicator;
