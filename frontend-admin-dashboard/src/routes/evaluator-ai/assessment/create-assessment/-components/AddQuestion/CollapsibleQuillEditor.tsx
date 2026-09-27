import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollapsibleQuillEditorProps } from '@/types/assessments/question-type-types';

export const CollapsibleQuillEditor: React.FC<CollapsibleQuillEditorProps> = ({
    value,
    onChange,
    onBlur,
}) => {
    const { t } = useTranslation('evaluatorAiCollapsibleQuillEditor');
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    return (
        <div className="">
            {!isExpanded ? (
                // Render only a single line preview
                <div className="flex cursor-pointer flex-row gap-1 rounded-md border bg-primary-50 p-2">
                    <div className="w-full max-w-[50vw] truncate text-body">
                        {value && value.replace(/<[^>]+>/g, '')}
                    </div>
                    <button
                        className="text-body text-primary-500"
                        onClick={() => setIsExpanded(true)}
                    >
                        {t('showMore')}
                    </button>
                </div>
            ) : (
                // Render full editor when expanded
                <div className="rounded-md border bg-primary-50 p-2">
                    <RichTextEditor
                        value={value}
                        onChange={onChange}
                        onBlur={onBlur}
                        minHeight={120}
                    />
                    <button
                        className="mt-2 text-body text-primary-500"
                        onClick={() => setIsExpanded(false)}
                    >
                        {t('showLess')}
                    </button>
                </div>
            )}
        </div>
    );
};
