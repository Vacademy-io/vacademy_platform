// src/lib/excalidrawUtils.ts
import { type ExcalidrawSceneData } from "@/types";
import axios from 'axios';

// This is a placeholder. In a real app, you'd fetch this from a URL (e.g., S3)
// using the fileId (source_id or content field from the slide object).
// The admin code uses getPublicUrl and UploadFileInS3V2.
// You would need a similar mechanism or an API endpoint to get the slide content.

const MOCKED_EXCALIDRAW_DATA: Record<string, ExcalidrawSceneData> = {
    "b4762686-84ef-48a1-bb83-e9b41eb8f4f9": { // Example ID from your sample
        elements: [
            { id: "1", type: "text", x: 100, y: 100, width: 200, height: 50, text: "Hello from Excalidraw!", strokeColor: "#000000", backgroundColor: "transparent", fillStyle: "hachure", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, angle: 0, seed: 12345, version: 2, versionNonce: 0, isDeleted: false, boundElements: null, updated: 0, link: null, locked: false, fontSize: 20, fontFamily: 1, textAlign: "center", verticalAlign: "middle", baseline: 18 },
        ],
        appState: { viewBackgroundColor: "#FFFFFF" },
    },
    "8bc45ea1-3cd0-4edb-86d9-7e58d1d476f6": {
        elements: [ { id: "2", type: "ellipse", x: 150, y: 150, width: 100, height: 100, strokeColor: "#FF6347", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2, strokeStyle: "dashed", roughness: 0, opacity: 80, angle: 0, seed: 67890, version: 2, versionNonce: 0, isDeleted: false, boundElements: null, updated: 0, link: null, locked: false } ],
        appState: { viewBackgroundColor: "#FAFAFA" },
    },
    "c6e41d32-4f41-4875-bef3-a9dd0901e540": {
        elements: [],
        appState: { viewBackgroundColor: "#F0F0F0", zenModeEnabled: true },
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
    console.log(`[ExcalidrawUtils] Attempting to fetch content for file ID: ${fileId}`);
    try {
    
        const publicUrl = await getPublicUrl(fileId);
        console.log(`[ExcalidrawUtils] Public URL: ${publicUrl}`);
        const response = await fetch(publicUrl);
        console.log(`[ExcalidrawUtils] Public Response: ${response}`);

        if (!response.ok) {
            console.error(`Failed to fetch Excalidraw content for ${fileId}: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return data as ExcalidrawSceneData;
    } catch (error) {
      console.error(`Error fetching Excalidraw content for ${fileId}:`, error);
      return null;
    }

    // Using mocked data for now:
    if (MOCKED_EXCALIDRAW_DATA[fileId]) {
        return new Promise(resolve => setTimeout(() => resolve(MOCKED_EXCALIDRAW_DATA[fileId]), 500));
    }
    console.warn(`[ExcalidrawUtils] No mocked data found for file ID: ${fileId}. Returning empty scene.`);
    return new Promise(resolve => setTimeout(() => resolve({ elements: [], appState: { viewBackgroundColor: '#FFFFFF' }}), 500));
};