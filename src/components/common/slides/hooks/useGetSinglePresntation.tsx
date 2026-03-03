/* eslint-disable */
// @ts-nocheck
import { TokenKey } from "@/constants/auth/tokens";
import { GET_PRESENTATION } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Presentation } from "../types";
import { getPublicUrl } from "@/services/upload_file";
import { SlideTypeEnum } from "../utils/types";

export const fetchPresentation = async (presentationId: string, setSlides: any, setCurrentSlideId: any) => {

    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (!accessToken) throw new Error("Authentication required");

        // 1. Get presentation metadata
        const presResponse = await authenticatedAxiosInstance.get(GET_PRESENTATION, {
            params: { presentationId },
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const addedSlides = presResponse?.data?.added_slides;

        if (!addedSlides?.length) throw new Error("No slides found in presentation");

        const sortedSlides = addedSlides.sort((a, b) => a.slide_order - b.slide_order);

        const slidesData = [];

        // 2. Loop over slides and fetch each slide's content
        for (const slide of sortedSlides) {
            try {
                if (slide.source === 'question' && slide.added_question) {
                    const questionData = slide.added_question;
                    const slideType = (questionData.question_type === 'MCQS' || questionData.question_type === 'MCQM')
                        ? SlideTypeEnum.Quiz
                        : SlideTypeEnum.Feedback;

                    let correctOptionIds: string[] = [];
                    try {
                        if (questionData.auto_evaluation_json) {
                            const parsedEval = JSON.parse(questionData.auto_evaluation_json);
                            // Backend may serialize as snake_case (correct_option_ids) or camelCase (correctOptionIds)
                            const ids = parsedEval?.data?.correctOptionIds || parsedEval?.data?.correct_option_ids;
                            if (ids && Array.isArray(ids)) {
                                correctOptionIds = ids;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse auto_evaluation_json", e);
                    }

                    const slideContent = {
                        id: slide.id,
                        slide_order: slide.slide_order,
                        type: slideType,
                        source_id: slide.content, // preserve so savePresentation can skip re-upload
                        questionId: questionData.id,
                        elements: {
                            questionName: questionData.text?.content || '',
                            singleChoiceOptions: (questionData.options || []).map((opt: any, index: number) => ({
                                id: opt.id, // Use the permanent DB ID for the option
                                name: opt.text?.content || '',
                                isSelected: correctOptionIds.includes(opt.id) || correctOptionIds.includes(String(opt.preview_id)) || correctOptionIds.includes(String(opt.option_order + 1)) || correctOptionIds.includes(String(index + 1)),
                            })),
                            feedbackAnswer: '',
                            timeLimit: questionData.default_question_time_mins * 60 || 60,
                        },
                    };
                    slidesData.push(slideContent);
                } else {
                    // Fallback to S3 for Excalidraw or other slide types
                const fileId = slide.content;
                const publicUrl = await getPublicUrl(fileId);

                const s3Response = await axios.get(publicUrl, {
                        responseType: 'json',
                        headers: { 'Cache-Control': 'no-cache' },
                });

                    let slideDataFromS3 = s3Response.data || {};

                    const slideContent = {
                        elements: [],
                        appState: {},
                        files: null,
                        ...slideDataFromS3,
                        id: slide.id,
                        slide_order: slide.slide_order,
                        type: slideDataFromS3.type || SlideTypeEnum.Excalidraw,
                        source_id: slide.content, // preserve so savePresentation can skip re-upload
                    };

                    if (!Array.isArray(slideContent.elements)) slideContent.elements = [];
                    if (typeof slideContent.appState !== 'object' || slideContent.appState === null) slideContent.appState = {};

                slidesData.push(slideContent);
                }
            } catch (innerErr) {
                console.error(`Error processing slide content for slide ID ${slide.id}:`, innerErr);
            }
        }

        // 3. Set and return
        if (slidesData.length > 0) {
            setSlides(slidesData);
            setCurrentSlideId(slidesData[0]?.id);
        }

        return slidesData;
    } catch (error) {
        console.error("Error fetching presentation:", error);
        throw new Error(
            error.response?.data?.message ||
            error.message ||
            "Failed to fetch presentation"
        );
    }
};

export const useGetSinglePresentation = ({
    presentationId,
    setSlides,
    setCurrentSlideId
}: {
    presentationId: string,
    setSlides: (slides: any) => void,
    setCurrentSlideId: (id: string) => void
}) => {
    return useQuery<
        Presentation & {
            slideContent?: any[];
        }
    >({
        queryKey: ["GET_PRESENTATION", presentationId],
        queryFn: () => fetchPresentation(presentationId, setSlides, setCurrentSlideId),
        onError: (error) => {
            console.error("Presentation fetch error:", error);
        },
        enabled: !!presentationId,
        refetchOnWindowFocus: false
    });
};
