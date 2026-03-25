import { useState, useCallback } from 'react';
import type { SlideGeneration, SlideType } from '../../../shared/types';

export const useSlideHandlers = (
    slides: SlideGeneration[],
    setSlides: React.Dispatch<React.SetStateAction<SlideGeneration[]>>
) => {
    // Handle slide edit - preserve all slide properties including status and content
    const handleSlideEdit = useCallback((slideId: string, newTitle: string) => {
        setSlides((prev) =>
            prev.map((slide) =>
                slide.id === slideId
                    ? { ...slide, slideTitle: newTitle } // Only update title, preserve status and content
                    : slide
            )
        );
    }, [setSlides]);

    // Handle slide content edit
    const handleSlideContentEdit = useCallback((slideId: string, newContent: string) => {
        setSlides((prev) =>
            prev.map((slide) =>
                slide.id === slideId
                    ? { ...slide, content: newContent } // Update content, preserve other properties
                    : slide
            )
        );
    }, [setSlides]);

    // Handle slide delete
    const handleDelete = useCallback((slideId: string) => {
        setSlides((prev) => {
            const updatedSlides = prev.filter((slide) => slide.id !== slideId);
            
            // Check if the deleted slide's session now only has a placeholder
            const deletedSlide = prev.find(s => s.id === slideId);
            if (deletedSlide) {
                const remainingSlidesInSession = updatedSlides.filter(s => s.sessionId === deletedSlide.sessionId);
                const onlyPlaceholder = remainingSlidesInSession.length === 1 && 
                                       remainingSlidesInSession[0]?.slideTitle === '_placeholder_';
                
                // If only placeholder remains, keep it so session stays visible
                // User can still add pages or delete the session
                if (onlyPlaceholder) {
                    return updatedSlides;
                }
            }
            
            return updatedSlides;
        });
    }, [setSlides]);

    return {
        handleSlideEdit,
        handleSlideContentEdit,
        handleDelete,
    };
};
