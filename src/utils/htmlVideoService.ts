// utils/htmlVideoService.ts
import axios from 'axios';
import { getTokenFromStorage } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Use the same URL as admin dashboard (direct call to AI service)
const AI_SERVICE_BASE_URL = "https://backend-stage.vacademy.io/ai-service";
const GET_VIDEO_URLS = (videoId: string) => 
    `${AI_SERVICE_BASE_URL}/video/urls/${videoId}`;

export interface HtmlVideoUrls {
    htmlUrl: string;
    audioUrl: string;
}

/**
 * Fetches HTML video URLs from AI service
 * Uses minimal headers (only Authorization) to match admin dashboard behavior
 */
export const fetchHtmlVideoUrls = async (videoId: string): Promise<HtmlVideoUrls> => {
    // Get access token directly
    const accessToken = await getTokenFromStorage(TokenKey.accessToken);
    
    if (!accessToken) {
        throw new Error('No access token found');
    }

    // Make request with minimal headers (only Authorization, like admin dashboard)
    const response = await axios.get(GET_VIDEO_URLS(videoId), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json, text/plain, */*',
        },
    });
    
    // Handle both snake_case (html_url, audio_url) and camelCase (htmlUrl, audioUrl) responses
    return {
        htmlUrl: response.data.html_url || response.data.htmlUrl || response.data.timelineUrl || '',
        audioUrl: response.data.audio_url || response.data.audioUrl || '',
    };
};

