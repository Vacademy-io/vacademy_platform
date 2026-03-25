import { SlideGeneration } from '../types';

/**
 * Extract slide titles from slides array
 */
export const extractSlideTitlesFromSlides = (slides: SlideGeneration[]): string[] => {
    return slides.reduce<string[]>((acc, slide) => {
        const isTopicSlide = slide.slideType === 'topic' || slide.slideTitle?.startsWith('Topic');
        if (!isTopicSlide) {
            return acc;
        }

        const match = slide.slideTitle?.match(/Topic \d+: (.+)/);
        const slideTitle = match?.[1]?.trim() ?? slide.slideTitle?.trim();
        if (slideTitle) {
            acc.push(slideTitle);
        }
        return acc;
    }, []);
};
