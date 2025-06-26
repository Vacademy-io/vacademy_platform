import { GET_PUBLIC_URL_PUBLIC } from "@/constants/urls";
import axios from "axios";

export const getPublicFileUrl = async (
  fileId: string,
  expiryDays = 1
): Promise<string> => {
  try {
    const response = await axios.get(GET_PUBLIC_URL_PUBLIC, {
      params: { fileId, expiryDays },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching public file URL:", error);
    throw new Error("Failed to fetch public URL.");
  }
};
