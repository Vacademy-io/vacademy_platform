import { queryOptions } from "@tanstack/react-query";
import { getPublicUrl } from "./upload_file";

export const getInstituteLogoQuery = (fileId: string | null) =>
  queryOptions({
    queryKey: ["institute-logo", fileId],
    queryFn: async () => {
      if (!fileId) return "";
      return await getPublicUrl(fileId);
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - logo rarely changes
    gcTime: 1000 * 60 * 60 * 24 * 7, // Keep in cache for 7 days
    enabled: !!fileId,
  });
