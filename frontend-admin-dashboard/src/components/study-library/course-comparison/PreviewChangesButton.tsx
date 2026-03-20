import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { MyButton } from '@/components/design-system/button';
import { CourseComparisonModal } from './CourseComparisonModal';

interface PreviewChangesButtonProps {
    currentCourseId: string;
    originalCourseId: string | null;
    subjectId: string;
    packageSessionId?: string;
    chapterId?: string;
    disabled?: boolean;
    className?: string;
}

export const PreviewChangesButton: React.FC<PreviewChangesButtonProps> = ({
    currentCourseId,
    originalCourseId,
    subjectId,
    packageSessionId,
    chapterId,
    disabled = false,
    className = '',
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);



    const handleClick = () => {
        setIsModalOpen(true);
    };

    return (
        <>
            <MyButton
                size="sm"
                buttonType="secondary"
                onClick={handleClick}
                disabled={disabled}
                className={`flex items-center space-x-2 border border-gray-300 bg-white !text-gray-800 hover:bg-gray-50 hover:!text-gray-900 ${className}`}
            >
                <Eye className="size-4 text-gray-600" />
                <span className="text-gray-800">
                    {originalCourseId ? 'Preview Changes' : 'View Content'}
                </span>
            </MyButton>

            <CourseComparisonModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                currentCourseId={currentCourseId}
                originalCourseId={originalCourseId}
                subjectId={subjectId}
                defaultPackageSessionId={packageSessionId}
                chapterId={chapterId}
            />
        </>
    );
};
