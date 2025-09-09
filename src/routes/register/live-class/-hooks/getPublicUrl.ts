import { GET_PUBLIC_URL_PUBLIC } from "@/constants/urls";
import { getWithETag } from "@/lib/http/etagClient";

export const getPublicFileUrl = async (
  fileId: string,
  expiryDays = 1
): Promise<string> => {
  try {
    return await getWithETag<string>(
      undefined,
      GET_PUBLIC_URL_PUBLIC,
      { fileId, expiryDays },
      { withCredentials: false }
    );
  } catch (error) {
    console.error("Error fetching public file URL:", error);
    throw new Error("Failed to fetch public URL.");
  }
};
