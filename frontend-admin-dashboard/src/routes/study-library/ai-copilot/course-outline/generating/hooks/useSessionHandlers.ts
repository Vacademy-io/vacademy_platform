import { useState, useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { SlideGeneration, SessionProgress } from '../../../shared/types';

export const useSessionHandlers = (
    slides: SlideGeneration[],
    setSlides: React.Dispatch<React.SetStateAction<SlideGeneration[]>>,
    sessionsWithProgress: SessionProgress[]
) => {
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editSessionTitle, setEditSessionTitle] = useState<string>('');

    // Handle session drag end
    const handleSessionDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = sessionsWithProgress.findIndex((s) => s.sessionId === active.id);
        const newIndex = sessionsWithProgress.findIndex((s) => s.sessionId === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedSessions = arrayMove(sessionsWithProgress, oldIndex, newIndex);
            // Update slides order based on new session order - preserve all slide properties
            const reorderedSlides: SlideGeneration[] = [];
            reorderedSessions.forEach((session) => {
                // Preserve all properties of slides when reordering
                reorderedSlides.push(...session.slides.map(slide => ({ ...slide })));
            });
            setSlides(reorderedSlides);
        }
    }, [sessionsWithProgress, setSlides]);

    // Handle session edit - preserve all slide properties including status and content
    const handleSessionEdit = useCallback((sessionId: string, newTitle: string) => {
        setSlides((prev) =>
            prev.map((slide) =>
                slide.sessionId === sessionId
                    ? { ...slide, sessionTitle: newTitle } // Only update title, preserve status and content
                    : slide
            )
        );
        setEditingSessionId(null);
        setEditSessionTitle('');
    }, [setSlides]);

    // Handle session delete
    const handleSessionDelete = useCallback((sessionId: string) => {
        setSlides((prev) => prev.filter((slide) => slide.sessionId !== sessionId));
    }, [setSlides]);

    // Start editing session
    const handleStartEdit = useCallback((sessionId: string, currentTitle: string) => {
        setEditingSessionId(sessionId);
        setEditSessionTitle(currentTitle);
    }, []);

    // Cancel editing session
    const handleCancelEdit = useCallback(() => {
        setEditingSessionId(null);
        setEditSessionTitle('');
    }, []);

    // Save edited session
    const handleSaveEdit = useCallback((sessionId: string) => {
        if (editSessionTitle.trim()) {
            handleSessionEdit(sessionId, editSessionTitle.trim());
        }
    }, [editSessionTitle, handleSessionEdit]);

    // Handle slide drag end within a session
    const handleSlideDragEnd = useCallback((event: DragEndEvent, sessionId: string) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const sessionSlides = slides.filter((s) => s.sessionId === sessionId);
        const oldIndex = sessionSlides.findIndex((s) => s.id === active.id);
        const newIndex = sessionSlides.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedSlides = arrayMove(sessionSlides, oldIndex, newIndex);
            // Update slides with new order - preserve all properties including status and content
            const otherSlides = slides.filter((s) => s.sessionId !== sessionId);
            setSlides([...otherSlides.map(s => ({ ...s })), ...reorderedSlides.map(s => ({ ...s }))]);
        }
    }, [slides, setSlides]);

    return {
        editingSessionId,
        editSessionTitle,
        setEditSessionTitle,
        handleSessionDragEnd,
        handleSessionEdit,
        handleSessionDelete,
        handleStartEdit,
        handleCancelEdit,
        handleSaveEdit,
        handleSlideDragEnd,
    };
};
