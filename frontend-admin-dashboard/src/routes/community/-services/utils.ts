import { useSelectedFilterStore } from "../-store/useSlectedFilterOption";
import { useFilterStore } from "../-store/useFilterOptions";
import {
    GET_QUESTION_PAPER_FILTERED_DATA_PUBLIC,
    INIT_FILTERS,
    GET_FILTERED_ENTITY_DATA,
} from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
// import {
//     transformFilterData,
// } from "./helper";
import { FilterOption } from "@/types/assessments/question-paper-filter";
import { FilterRequest, FilteredEntityApiResponse, Tag } from "@/types/community/filters/types";
import {
    PaginatedResponse,
    // QuestionPaperInterface,
} from "@/types/assessments/question-paper-template";

export async function fetchStaticData() {
    try {
        const response = await authenticatedAxiosInstance({
            method: "GET",
            url: `${INIT_FILTERS}`,
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
}

export const getFilteredEntityData = async (
    pageNo: number,
    pageSize: number,
    data: FilterRequest,
): Promise<FilteredEntityApiResponse> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${GET_FILTERED_ENTITY_DATA}`,
            params: {
                pageNo,
                pageSize,
            },
            data,
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

export const mapFiltersToTags = (): FilterRequest => {
    const { selected, name } = useSelectedFilterStore.getState();
    const { selectedChips } = useFilterStore.getState();
    console.log(selected);
    console.log(selectedChips);
    const tags: Tag[] = [];

    if (selected.difficulty) {
        tags.push({ tagId: selected.difficulty, tagSource: "DIFFICULTY" });
    }
    if (selected.level) {
        tags.push({ tagId: selected.level.levelId, tagSource: "LEVEL" });
    }
    if (selected.subject) {
        tags.push({ tagId: selected.subject.subjectId, tagSource: "SUBJECT" });
    }
    if (selected.topic) {
        tags.push({ tagId: selected.topic, tagSource: "TOPIC" });
    }
    if (selected.stream) {
        tags.push({ tagId: selected.stream.streamId, tagSource: "STREAM" });
    }

    for (let i = 0; i < selectedChips.length; i++) {
        const chip = selectedChips[i]; // Store in a variable
        if (chip?.tagId && chip?.tagSource) {
            tags.push({ tagId: chip.tagId, tagSource: chip.tagSource });
        }
    }
    console.log("tags ", tags);

    //TODO: for now only type available is question paper in future new types will be added
    return {
        type: "QUESTION_PAPER", // Ensure it's of the correct type
        name: name,
        tags: tags.length > 0 ? tags : undefined, // Only include `tags` if there are any
    };
};

export const getQuestionPaperDataWithFilters = async (
    pageNo: number,
    pageSize: number,
    data: Record<string, FilterOption[]>,
): Promise<PaginatedResponse> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${GET_QUESTION_PAPER_FILTERED_DATA_PUBLIC}`,
            params: {
                pageNo,
                pageSize,
            },
            // data: transformFilterData(data),
            data,
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};
