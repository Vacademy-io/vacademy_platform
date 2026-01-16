import { queryOptions } from "@tanstack/react-query";
import { getPublicUrlWithoutLogin } from "./upload_file";

/**
 * Query options for fetching public file URLs (thumbnails, images, etc.)
 * Cached for 6 hours since file URLs rarely change
 * This cache is shared across the entire application
 */
export const getFilePublicUrlQuery = (fileId: string | null) =>
  queryOptions({
    queryKey: ["file-public-url", fileId],
    queryFn: async () => {
      if (!fileId) return "";
      return await getPublicUrlWithoutLogin(fileId);
    },
    staleTime: 1000 * 60 * 60 * 6, // 6 hours - file URLs rarely change
    gcTime: 1000 * 60 * 60 * 12, // Keep in cache for 12 hours
    enabled: !!fileId,
  });
