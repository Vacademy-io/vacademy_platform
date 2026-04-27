import axios from "axios";
import { urlOpenInstituteTags } from "@/constants/urls";

export const fetchInstituteCatalogueTags = async (
    instituteId: string
): Promise<string[]> => {
    if (!instituteId) return [];
    const response = await axios.get<string[]>(urlOpenInstituteTags, {
        params: { instituteId },
    });
    return Array.isArray(response.data) ? response.data : [];
};
