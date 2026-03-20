import { SlideTypeEnum } from './types';
import type { Slide as AppSlide } from './types';
import {
    titleSlide,
    textSlide,
    webEmbedSlide,
    videoSlide,
    textMediaSlide,
    fullMediaSlide,
} from '../constant/textSlide';

export const createNewSlide = (type: SlideTypeEnum): AppSlide => {
    const baseSlide = {
        id: `temp-${Date.now()}-${Math.random()}`,
        type: type,
        slide_order: 0, // Placeholder, will be updated by useSlideStore
        elements: [],
        appState: {},
        files: {},
    };

    switch (type) {
        case SlideTypeEnum.Title:
            return { ...baseSlide, elements: [] };
        case SlideTypeEnum.Text:
            return { ...baseSlide, elements: [] };
        case SlideTypeEnum.Excalidraw: // Assuming WebLink, Video, etc. are Excalidraw based
            return { ...baseSlide, elements: [] };
        case SlideTypeEnum.Quiz:
            return {
                ...baseSlide,
                type: SlideTypeEnum.Quiz,
                elements: {
                    questionName: '',
                    singleChoiceOptions: [
                        {
                            id: `temp-opt-${Date.now()}-0-${Math.random()}`,
                            name: '',
                            isSelected: false,
                        },
                        {
                            id: `temp-opt-${Date.now()}-1-${Math.random()}`,
                            name: '',
                            isSelected: false,
                        },
                        {
                            id: `temp-opt-${Date.now()}-2-${Math.random()}`,
                            name: '',
                            isSelected: false,
                        },
                        {
                            id: `temp-opt-${Date.now()}-3-${Math.random()}`,
                            name: '',
                            isSelected: false,
                        },
                    ],
                    timeLimit: 60,
                },
            };
        case SlideTypeEnum.Feedback:
            return {
                ...baseSlide,
                type: SlideTypeEnum.Feedback,
                elements: {
                    questionName: '',
                    feedbackAnswer: '',
                },
            };
        default:
            return { ...baseSlide, type: SlideTypeEnum.Excalidraw };
    }
};

export function filterSlidesByIdType(slides: AppSlide[], isNew: boolean): Partial<AppSlide>[] {
    return slides
        .filter((slide) => {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
                slide.id
            );
            return isNew ? !isUUID : isUUID;
        })
        .map((slide) => {
            if (isNew) {
                const { id, ...rest } = slide;
                return rest;
            }
            return slide;
        });
}
