import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { SCRAPE_URL } from '@/constants/urls';

/**
 * Scrape readable content + title from a URL (used by the AI copilot).
 *
 * The legacy media-service course-generation client that used to live in this
 * file (sendChatMessage/Streaming via /media-service/course/ai/v1/generate) was
 * removed: that "ai-course-builder" feature is retired and course generation now
 * lives in ai_service (see /study-library/ai-copilot). Only the URL scraper,
 * which already targets ai_service via SCRAPE_URL, remains.
 */
export const scrapeUrlContent = async (
    url: string
): Promise<{ content: string; title: string }> => {
    try {
        const response = await authenticatedAxiosInstance.post(SCRAPE_URL, { url });
        return response.data;
    } catch (error) {
        console.error('Error scraping URL:', error);
        throw error;
    }
};
