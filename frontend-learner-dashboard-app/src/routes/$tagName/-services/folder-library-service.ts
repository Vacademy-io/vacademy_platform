import axios from "axios";
import { BASE_URL } from "@/constants/urls";

/**
 * Public read of a folder library, for the catalogue `folderBrowser` section.
 * The server already drops hidden branches and product pages that are not
 * ACTIVE (see PublicCatalogueFolderController); empty folders are pruned here
 * because whether to show them is a per-section choice.
 */

const publicAxios = axios.create({ withCredentials: false });

const API_BASE = `${BASE_URL}/admin-core-service/public/folder-library/v1`;

export type FolderLayout = "cards" | "tiles" | "list";
export type FolderImageShape = "landscape" | "square" | "portrait" | "none";

export interface FolderView {
  layout?: FolderLayout;
  imageShape?: FolderImageShape;
  columns?: number;
  showDescription?: boolean;
  showCounts?: boolean;
}

export interface PublicFolderNode {
  id: string;
  parent_id?: string | null;
  node_type: "FOLDER" | "PRODUCT_PAGE";
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  product_page_code?: string | null;
  product_page_name?: string | null;
  view?: FolderView | null;
  children: PublicFolderNode[];
}

export interface PublicFolderTree {
  library: { id: string; name: string };
  roots: PublicFolderNode[];
}

export const fetchPublicFolderTree = async (
  instituteId: string,
  libraryId: string,
): Promise<PublicFolderTree> =>
  (
    await publicAxios.get<PublicFolderTree>(`${API_BASE}/tree`, {
      params: { instituteId, libraryId },
    })
  ).data;

/** A folder survives pruning only while something a visitor can open is inside it. */
export const pruneEmptyFolders = (nodes: PublicFolderNode[]): PublicFolderNode[] =>
  nodes.flatMap((n) => {
    if (n.node_type !== "FOLDER") return [n];
    const children = pruneEmptyFolders(n.children || []);
    return children.length ? [{ ...n, children }] : [];
  });

/** Path from the top down to `id`, inclusive; [] when it is not in `nodes`. */
export const pathTo = (nodes: PublicFolderNode[], id: string | null | undefined): PublicFolderNode[] => {
  if (!id) return [];
  for (const n of nodes) {
    if (n.id === id) return [n];
    const below = pathTo(n.children || [], id);
    if (below.length) return [n, ...below];
  }
  return [];
};

export const nodeTitle = (n: PublicFolderNode): string =>
  (n.title || "").trim() || (n.product_page_name || "").trim();
