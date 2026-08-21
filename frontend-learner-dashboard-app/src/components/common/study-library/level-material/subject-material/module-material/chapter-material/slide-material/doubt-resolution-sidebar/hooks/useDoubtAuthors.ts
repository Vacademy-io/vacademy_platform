import { useQuery } from "@tanstack/react-query";
import { getUserBasicDetails } from "@/services/getBasicUserDetails";
import { getPublicUrls } from "@/services/upload_file";
import { Doubt } from "../types/get-doubts-type";

export interface DoubtAuthor {
  name?: string;
  avatarUrl?: string;
}

export type DoubtAuthorMap = Record<string, DoubtAuthor>;

/** Every user id in the thread tree (doubt authors + repliers, at any depth). */
export const collectAuthorIds = (doubts: Doubt[]): string[] => {
  const ids = new Set<string>();
  const walk = (nodes: Doubt[] | undefined) => {
    nodes?.forEach((node) => {
      if (node?.user_id) ids.add(node.user_id);
      walk(node.replies);
    });
  };
  walk(doubts);
  // Sorted so the query key is stable regardless of list order.
  return Array.from(ids).sort();
};

/**
 * Resolves names + avatars for a whole doubts thread in ONE round trip each.
 *
 * Previously every Doubt and every Reply called useGetUserBasicDetails([id])
 * and getPublicUrl(faceFileId) on its own, so a panel with 10 doubts and their
 * replies fired 20-40 requests and the avatars/names popped in one by one.
 */
export const useDoubtAuthors = (userIds: string[]): DoubtAuthorMap => {
  const key = userIds.join(",");

  const { data } = useQuery({
    queryKey: ["doubt-authors", key],
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DoubtAuthorMap> => {
      const details = await getUserBasicDetails(userIds);
      const list: Array<{ id?: string; user_id?: string; name?: string; face_file_id?: string }> =
        Array.isArray(details) ? details : [];

      const map: DoubtAuthorMap = {};
      list.forEach((user) => {
        const id = user.user_id || user.id;
        if (id) map[id] = { name: user.name };
      });

      const faceIds = list
        .map((user) => user.face_file_id)
        .filter((id): id is string => !!id);

      if (faceIds.length > 0) {
        try {
          const files = await getPublicUrls(Array.from(new Set(faceIds)).join(","));
          const urlById = new Map<string, string>(
            (Array.isArray(files) ? files : [])
              .filter((file: { id?: string; url?: string }) => file?.id && file?.url)
              .map((file: { id: string; url: string }) => [file.id, file.url])
          );
          list.forEach((user) => {
            const id = user.user_id || user.id;
            if (!id || !user.face_file_id) return;
            const url = urlById.get(user.face_file_id);
            if (url && map[id]) map[id].avatarUrl = url;
          });
        } catch {
          // Avatars are decorative — names still render without them.
        }
      }

      return map;
    },
  });

  return data ?? {};
};
