// src/lib/excalidrawUtils.ts
import axios from 'axios';

// Define the type locally with proper typing
export interface ExcalidrawSceneData {
  elements: any[]; // Using any for now to avoid type complexity
  appState?: any;
  files?: any;
}

// Mocked data for fallback (kept for development/testing purposes)
const MOCKED_EXCALIDRAW_DATA: Record<string, ExcalidrawSceneData> = {
    "default": {
        elements: [
            {
                id: "fallback-text",
                type: "text",
                x: 10,
                y: 10,
                width: 300,
                height: 100,
                text: "Fallback Content - API data not available",
                strokeColor: "#666666",
                backgroundColor: "transparent",
                fillStyle: "hachure",
                strokeWidth: 1,
                strokeStyle: "solid",
                roughness: 1,
                opacity: 100,
                angle: 0,
                seed: 12345,
                version: 2,
                versionNonce: 0,
                isDeleted: false,
                boundElements: null,
                updated: 0,
                link: null,
                locked: false,
                fontSize: 20,
                fontFamily: 1,
                textAlign: "left",
                verticalAlign: "top",
                baseline: 18
            }
        ],
        appState: { 
            viewBackgroundColor: "#F8F9FA",
            collaborators: new Map(),
            currentItemFontFamily: 1,
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0
        },
    }
};

export const GET_PUBLIC_URL_PUBLIC = `https://backend-stage.vacademy.io/media-service/public/get-public-url`;

export const getPublicUrl = async (fileId: string | undefined | null): Promise<string> => {
    const response = await axios.get(GET_PUBLIC_URL_PUBLIC, {
        params: { fileId, expiryDays: 1 },
    });
    return response?.data;
};

export const fetchExcalidrawContent = async (fileId: string): Promise<ExcalidrawSceneData | null> => {
    console.log(`[ExcalidrawUtils] Fetching content for fileId: ${fileId}`);
    
    try {
        // Get the public URL for the file
        console.log(`[ExcalidrawUtils] Getting public URL for fileId: ${fileId}`);
        const publicUrl = await getPublicUrl(fileId);
        console.log(`[ExcalidrawUtils] Received public URL:`, publicUrl);
        
        if (!publicUrl) {
            throw new Error('No public URL received from API');
        }

        // Fetch the actual Excalidraw data from the public URL
        console.log(`[ExcalidrawUtils] Fetching data from URL: ${publicUrl}`);
        const response = await fetch(publicUrl);
        console.log(`[ExcalidrawUtils] Fetch response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch Excalidraw content: ${response.status} ${response.statusText}`);
        }
        
        // Get the response as text first to see what we're getting
        const responseText = await response.text();
        console.log(`[ExcalidrawUtils] Response text (first 200 chars):`, responseText.substring(0, 200));
        
        // Check if it looks like HTML
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            throw new Error(`Received HTML instead of JSON. Response starts with: ${responseText.substring(0, 100)}`);
        }
        
        // Try to parse as JSON
        const data = JSON.parse(responseText);
        console.log(`[ExcalidrawUtils] Parsed JSON data:`, data);
        console.log(`[ExcalidrawUtils] Elements found: ${data.elements?.length || 0}`);
        console.log(`[ExcalidrawUtils] Original appState:`, data.appState);

        // Ensure appState has the correct structure with proper Map for collaborators
        const appState = {
            viewBackgroundColor: "#FFFFFF",
            currentItemFontFamily: 1,
            zoom: { value: 1 },
            scrollX: 0,
            scrollY: 0,
            // Spread the original appState but override critical properties
            ...(data.appState || {}),
            // Force these to be correct types
            collaborators: new Map(), // Ensure this is always a Map
        };

        console.log(`[ExcalidrawUtils] Processed appState:`, appState);

        const result = {
            elements: data.elements || [],
            appState,
            files: data.files || {}
        } as ExcalidrawSceneData;

        console.log(`[ExcalidrawUtils] Returning successful result with ${result.elements.length} elements`);
        return result;
    } catch (error) {
        console.error(`[ExcalidrawUtils] Error fetching Excalidraw content for ${fileId}:`, error);
        console.log(`[ExcalidrawUtils] Returning fallback content`);
        
        // Return fallback content instead of null to provide better user experience
        return MOCKED_EXCALIDRAW_DATA["default"];
    }
};