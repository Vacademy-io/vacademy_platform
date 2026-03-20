'use client';

import { MyButton } from '@/components/design-system/button';
import { MyDropdown } from '@/components/design-system/dropdown';
import {
    Plus,
    FilePdf,
    FileDoc,
    YoutubeLogo,
    Question,
    PresentationChart,
    Code,
    BookOpen,
    File,
    GameController,
    ClipboardText,
} from '@phosphor-icons/react';

interface AISlideDropdownProps {
    onSlideTypeSelect: (type: string, name?: string) => void;
    disabled?: boolean;
}

export const AISlideDropdown: React.FC<AISlideDropdownProps> = ({
    onSlideTypeSelect,
    disabled = false,
}) => {
    const dropdownList = [
        {
            label: 'PDF Document',
            value: 'pdf',
            icon: <FilePdf className="size-4 text-red-500" />,
            description: 'Upload PDF files',
        },
        {
            label: 'Document',
            value: 'document',
            icon: <FileDoc className="size-4 text-blue-600" />,
            description: 'Text documents',
        },
        {
            label: 'Video',
            value: 'video',
            icon: <YoutubeLogo className="size-4 text-green-500" />,
            description: 'Video content',
        },
        {
            label: 'Question',
            value: 'question',
            icon: <Question className="size-4 text-purple-500" />,
            description: 'Interactive questions',
        },
        {
            label: 'Assignment',
            value: 'assignment',
            icon: <File className="size-4 text-blue-500" />,
            description: 'Student assignments',
        },
        {
            label: 'Presentation',
            value: 'presentation',
            icon: <PresentationChart className="size-4 text-orange-500" />,
            description: 'Interactive presentations',
        },
        {
            label: 'Jupyter Notebook',
            value: 'jupyter-notebook',
            icon: <BookOpen className="size-4 text-violet-500" />,
            description: 'Interactive coding notebooks',
        },
        {
            label: 'Scratch Project',
            value: 'scratch-project',
            icon: <GameController className="size-4 text-yellow-500" />,
            description: 'Visual programming blocks',
        },
        {
            label: 'Quiz',
            value: 'quiz',
            icon: <ClipboardText className="size-4 text-pink-500" />,
            description: 'Timed quiz slide',
        },
        {
            label: 'Code Editor',
            value: 'code-editor',
            icon: <Code className="size-4 text-green-500" />,
            description: 'Interactive code environment',
        },
    ];

    const handleSelect = (value: string) => {
        // Generate a default name based on the slide type
        const slideTypeNames: Record<string, string> = {
            pdf: 'PDF Document',
            document: 'New Document',
            video: 'Video Content',
            question: 'Question',
            assignment: 'Assignment',
            presentation: 'Presentation',
            'jupyter-notebook': 'Jupyter Notebook',
            'scratch-project': 'Scratch Project',
            quiz: 'Quiz',
            'code-editor': 'Code Editor',
        };

        const defaultName = slideTypeNames[value] || 'New Slide';

        // Pass the original type directly to CourseExplorer
        onSlideTypeSelect(value, defaultName);
    };

    return (
        <div className="ai-slide-dropdown-container ai-slide-dropdown">
            <MyDropdown dropdownList={dropdownList} onSelect={handleSelect}>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    disabled={disabled}
                    className={`
                        group relative h-6 w-auto
                        overflow-hidden border-0 bg-gradient-to-r
                        from-primary-400 to-primary-400
                        px-2 text-xs
                        shadow-sm shadow-primary-500/20 transition-all
                        duration-300 ease-in-out
                        hover:scale-[1.02] hover:from-primary-400
                        hover:to-primary-400 hover:shadow-md
                        hover:shadow-primary-500/25 active:scale-[0.98] ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                    `}
                    style={{ zIndex: 10020 }} // Higher z-index to fix popup issue
                >
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 transition-transform duration-700 ease-out group-hover:translate-x-full" />

                    <div className="relative z-10 flex items-center justify-center gap-1">
                        <Plus
                            className={`
                            size-3 transition-all duration-300
                            ease-in-out group-hover:rotate-90
                            group-hover:scale-110
                        `}
                        />
                        <span className="text-xs font-medium tracking-wide">Add</span>
                    </div>
                </MyButton>
            </MyDropdown>
        </div>
    );
};
