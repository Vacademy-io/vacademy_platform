import { useState, useCallback } from 'react';

export const useMetadataHandlers = (
    courseMetadata: any,
    setCourseMetadata: React.Dispatch<React.SetStateAction<any>>
) => {
    const [editingMetadataField, setEditingMetadataField] = useState<string | null>(null);
    const [metadataEditValues, setMetadataEditValues] = useState<Record<string, any>>({});
    const [mediaEditMode, setMediaEditMode] = useState<'upload' | 'youtube' | null>(null);

    const handleEditMetadataField = useCallback((field: string, currentValue: any) => {
        setEditingMetadataField(field);
        setMetadataEditValues({ [field]: currentValue });
    }, []);

    const handleCancelMetadataEdit = useCallback(() => {
        setEditingMetadataField(null);
        setMetadataEditValues({});
    }, []);

    const handleSaveMetadataEdit = useCallback((field: string) => {
        if (courseMetadata) {
            const updatedMetadata = {
                ...courseMetadata,
                [field]: metadataEditValues[field],
            };
            setCourseMetadata(updatedMetadata);
        }
        setEditingMetadataField(null);
        setMetadataEditValues({});
    }, [courseMetadata, metadataEditValues, setCourseMetadata]);

    return {
        editingMetadataField,
        metadataEditValues,
        setMetadataEditValues,
        mediaEditMode,
        setMediaEditMode,
        handleEditMetadataField,
        handleCancelMetadataEdit,
        handleSaveMetadataEdit,
    };
};
