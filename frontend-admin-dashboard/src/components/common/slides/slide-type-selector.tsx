import React from 'react';
import { Button } from '@/components/ui/button';
import {
    LayoutTemplate,
    Type,
    Square,
    Image,
    HelpCircle,
    MessageCircle,
    PenTool,
} from 'lucide-react';
import { SlideType } from './types';

interface SlideTypeOption {
    type: SlideType;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const slideTypeOptions: SlideTypeOption[] = [
    {
        type: SlideType.Title,
        label: 'Title',
        icon: <LayoutTemplate className="size-5" />,
        description: 'Title and subtitle layout',
    },
    {
        type: SlideType.Text,
        label: 'Text',
        icon: <Type className="size-5" />,
        description: 'Text content layout',
    },
    {
        type: SlideType.Blank,
        label: 'Blank',
        icon: <Square className="size-5" />,
        description: 'Empty slide',
    },
    {
        type: SlideType.Image,
        label: 'Image',
        icon: <Image className="size-5" />,
        description: 'Image with optional caption',
    },
    {
        type: SlideType.Quiz,
        label: 'Quiz',
        icon: <HelpCircle className="size-5" />,
        description: 'Multiple choice question',
    },
    {
        type: SlideType.Feedback,
        label: 'Feedback',
        icon: <MessageCircle className="size-5" />,
        description: 'Collect feedback',
    },
    {
        type: SlideType.Excalidraw,
        label: 'Draw',
        icon: <PenTool className="size-5" />,
        description: 'Freeform drawing',
    },
];

interface SlideTypeSelectorProps {
    onSelect: (type: SlideType) => void;
}

export const SlideTypeSelector: React.FC<SlideTypeSelectorProps> = ({ onSelect }) => {
    return (
        <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 md:grid-cols-4">
            {slideTypeOptions.map((option) => (
                <Button
                    key={option.type}
                    variant="outline"
                    className="flex h-auto flex-col items-center gap-2 p-3 text-center"
                    onClick={() => onSelect(option.type)}
                >
                    {option.icon}
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-gray-500">{option.description}</span>
                </Button>
            ))}
        </div>
    );
};
