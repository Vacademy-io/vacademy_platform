import { queryOptions } from "@tanstack/react-query";
import { getPublicUrlWithoutLogin, isDirectUrl } from "./upload_file";

/**
 * Query options for fetching public file URLs (thumbnails, images, etc.)
 * If fileId is already a direct http(s) URL, it is returned as-is (no file API call).
 * Cached for 6 hours since file URLs rarely change.
 * This cache is shared across the entire application.
 */
export const getFilePublicUrlQuery = (fileId: string | null) =>
  queryOptions({
    queryKey: ["file-public-url", fileId],
    queryFn: async () => {
      if (!fileId) return "";
      if (isDirectUrl(fileId)) return fileId.trim();
      return await getPublicUrlWithoutLogin(fileId);
    },
    staleTime: 1000 * 60 * 60 * 6, // 6 hours - file URLs rarely change
    gcTime: 1000 * 60 * 60 * 12, // Keep in cache for 12 hours
    enabled: !!fileId,
  });
