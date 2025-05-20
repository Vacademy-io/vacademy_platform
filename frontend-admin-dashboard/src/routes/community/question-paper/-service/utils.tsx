import {
    GET_QUESTION_PAPER_BY_ID,
    MARK_QUESTION_PAPER_STATUS,
    GET_TAGS_BY_QUESTION_PAPER_ID,
    ADD_PUBLIC_QUESTION_PAPER_TO_PRIVATE_INSTITUTE,
} from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { QuestionPaperData } from "@/types/community/filters/types";

export const getQuestionPaperById = async (questionPaperId: string) => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "GET",
            url: `${GET_QUESTION_PAPER_BY_ID}`,
            params: {
                questionPaperId,
            },
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

export const processHtmlString = (htmlString: string) => {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    // Array to store processed content
    const processedContent: Array<{ type: "text" | "image"; content: string }> = [];
    // Iterate through child nodes
    tempDiv.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            // Process text nodes
            const trimmedText = node.textContent?.trim();
            if (trimmedText) {
                processedContent.push({
                    type: "text",
                    content: trimmedText,
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            // Process image nodes
            if (element.tagName.toLowerCase() === "img") {
                const src = element.getAttribute("src");
                if (src) {
                    processedContent.push({
                        type: "image",
                        content: src,
                    });
                }
            } else {
                // Process other elements' text content
                const text = element.textContent?.trim();
                if (text) {
                    processedContent.push({
                        type: "text",
                        content: text,
                    });
                }
            }
        }
    });
    return processedContent;
};

export const markQuestionPaperStatus = async (
    status: string,
    questionPaperId: string,
    instituteId: string,
) => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${MARK_QUESTION_PAPER_STATUS}`,
            data: { status, question_paper_id: questionPaperId, institute_id: instituteId },
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

export const getTageByQuestionPaperId = async (
    questionPaperId: string,
): Promise<QuestionPaperData> => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "GET",
            url: `${GET_TAGS_BY_QUESTION_PAPER_ID}`,
            params: {
                questionPaperId,
            },
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};

export const addPublicQuestionPaperToPrivate = async (
    instituteId: string,
    questionPaperId: string,
) => {
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${ADD_PUBLIC_QUESTION_PAPER_TO_PRIVATE_INSTITUTE}`,
            params: {
                instituteId,
                questionPaperId,
            },
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`${error}`);
    }
};
