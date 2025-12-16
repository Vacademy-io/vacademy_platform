import { GET_PUBLIC_MEDIA_DETAILS } from "@/constants/urls";
import type { PublicMediaDetails } from "../-types/types";

const EXPIRY_DAYS = 7; // Fixed expiry days as per requirement

export async function getPublicMediaDetails(fileId: string): Promise<PublicMediaDetails> {
    const url = `${GET_PUBLIC_MEDIA_DETAILS}?fileId=${encodeURIComponent(fileId)}&expiryDays=${EXPIRY_DAYS}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch media details: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
