import axios from "axios";
import { urlCourseDetails } from "@/constants/urls";

export interface BookCataloguePageParams {
    instituteId: string;
    levelIds: string[];
    sessionIds?: string[];
    searchByName: string;
    tags: string[];
    page: number;
    size: number;
}

export interface BookCatalogueItem {
    id: string;
    package_name?: string;
    package_type?: string;
    level_id?: string;
    level_name?: string;
    session_id?: string;
    session_name?: string;
    package_session_id?: string;
    enroll_invite_id?: string;
    course_banner_media_id?: string;
    course_preview_image_media_id?: string;
    course_html_description_html?: string;
    comma_separeted_tags?: string;
    min_plan_actual_price?: number;
    min_plan_elevated_price?: number;
    currency?: string;
    instructors?: Array<{ full_name?: string }>;
    available_slots?: number;
    availableSlots?: number;
    max_seats?: number;
    rating?: number;
    estimated_duration?: string;
    [key: string]: any;
}

export interface BookCataloguePage {
    content: BookCatalogueItem[];
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
    last: boolean;
    first: boolean;
}

export const fetchBookCataloguePage = async (
    params: BookCataloguePageParams
): Promise<BookCataloguePage> => {
    const { instituteId, levelIds, sessionIds, searchByName, tags, page, size } = params;

    const response = await axios.post<BookCataloguePage>(
        urlCourseDetails,
        {
            status: [],
            level_ids: levelIds,
            session_ids: sessionIds && sessionIds.length > 0 ? sessionIds : [],
            faculty_ids: [],
            search_by_name: searchByName,
            tag: tags,
            package_types: ["COURSE"],
            min_percentage_completed: 0,
            max_percentage_completed: 0,
        },
        {
            params: {
                instituteId,
                page,
                size,
                sort: "createdAt,desc",
            },
            headers: { "Content-Type": "application/json" },
        }
    );

    return response.data;
};

export interface CatalogueStore {
    id: string;
    name: string;
}

/**
 * One-time discovery fetch for the store picker. Pulls a wide page of the
 * catalogue with the current level filter (so the store list reflects what
 * the user can actually browse) and extracts distinct sessions.
 */
export const fetchCatalogueStores = async (
    instituteId: string,
    levelIds: string[]
): Promise<CatalogueStore[]> => {
    const response = await axios.post<BookCataloguePage>(
        urlCourseDetails,
        {
            status: [],
            level_ids: levelIds,
            session_ids: [],
            faculty_ids: [],
            search_by_name: "",
            tag: [],
            package_types: ["COURSE"],
            min_percentage_completed: 0,
            max_percentage_completed: 0,
        },
        {
            params: { instituteId, page: 0, size: 500, sort: "createdAt,desc" },
            headers: { "Content-Type": "application/json" },
        }
    );
    const seen = new Map<string, string>();
    for (const item of response.data?.content ?? []) {
        if (item.session_id && !seen.has(item.session_id)) {
            seen.set(item.session_id, item.session_name || "");
        }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
};
