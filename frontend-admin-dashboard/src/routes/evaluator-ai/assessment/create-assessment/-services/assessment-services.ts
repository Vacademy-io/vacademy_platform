import { ADD_QUESTIONS_URL, CREATE_ASSESSMENT_URL, GET_ASSESSMENT_URL } from "@/constants/urls";
import { ConvertedCustomField, CustomFields } from "@/types/assessments/assessment-data-type";
import { z } from "zod";
import { BasicInfoFormSchema } from "../-utils/basic-info-form-schema";
import sectionDetailsSchema from "../-utils/section-details-sechma";
import { classifySections, convertStep2Data } from "../-utils/helper";
import { ApiResponse, SectionResponse } from "../-hooks/getQuestionsDataForSection";
import axios from "axios";
import { toast } from "sonner";

export const getAssessmentDetailsData = async ({
    assessmentId,
}: {
    assessmentId: string | null | undefined;
}): Promise<ApiResponse> => {
    const response = await axios({
        method: "GET",
        url: `${GET_ASSESSMENT_URL}/${assessmentId}`,
    });
    return response?.data as ApiResponse;
};

export const getAssessmentDetails = ({
    assessmentId,
}: {
    assessmentId: string | null | undefined;
}) => {
    return {
        queryKey: ["GET_ASSESSMENT_DETAILS", assessmentId],
        queryFn: () => getAssessmentDetailsData({ assessmentId }),
        staleTime: 60 * 60 * 1000,
        enabled: !!assessmentId,
    };
};

export const handleUpdateCriteria = async ({
    assessmentId,
    sectionDetails,
}: {
    assessmentId: string;
    sectionDetails: SectionResponse[];
}) => {
    try {
        const response = await axios({
            method: "POST",
            url: ADD_QUESTIONS_URL,
            params: {
                assessmentId,
            },
            data: sectionDetails,
        });
        if (response.status === 200) {
            toast.success("Criteria has been updated");
        }
        return response.data;
    } catch (error) {
        console.log("Error updating criteria", error);
        throw error;
    }
};

export const handlePostStep1Data = async (data: z.infer<typeof BasicInfoFormSchema>) => {
    const transformedData = {
        status: data.status,
        test_creation: {
            assessment_name: data.testCreation.assessmentName,
            subject_id: data.testCreation.subject,
            assessment_instructions_html: data.testCreation.assessmentInstructions,
        },
        test_boundation: {
            start_date: data.testCreation.liveDateRange.startDate,
            end_date: data.testCreation.liveDateRange.endDate,
        },
        assessment_preview_time: data.assessmentPreview.checked
            ? parseInt(data.assessmentPreview.previewTimeLimit)
            : 0,
        default_reattempt_count: data.reattemptCount,
        switch_sections: data.switchSections,
        evaluation_type: data.evaluationType,
        submission_type: data.submissionType,
        raise_reattempt_request: data.raiseReattemptRequest,
        raise_time_increase_request: data.raiseTimeIncreaseRequest,
    };
    const response = await axios({
        method: "POST",
        url: CREATE_ASSESSMENT_URL,
        data: transformedData,
        params: {},
    });
    return response?.data;
};

export const handlePostStep2Data = async (
    oldData: z.infer<typeof sectionDetailsSchema>,
    data: z.infer<typeof sectionDetailsSchema>,
    assessmentId: string | null,
) => {
    const convertedOldData = convertStep2Data(oldData);
    const convertedNewData = convertStep2Data(data);
    const classifiedSections = classifySections(convertedOldData, convertedNewData);
    const convertedData = {
        test_duration: {},
        added_sections: classifiedSections.added_sections,
        updated_sections: classifiedSections.updated_sections,
        deleted_sections: classifiedSections.deleted_sections,
    };
    const response = await axios({
        method: "POST",
        url: ADD_QUESTIONS_URL,
        data: convertedData,
        params: {
            assessmentId,
        },
    });
    return response?.data;
};

// Type definition for each converted custom field

// Function that converts customFields to the desired structure
export const convertCustomFields = (customFields: CustomFields): ConvertedCustomField[] => {
    const convertedFields = customFields.map((field) => {
        return {
            id: field.id,
            name: field.name,
            type: field.type,
            default_value: "", // Provide a default value, if necessary
            description: "", // Provide a description, if necessary
            is_mandatory: field.isRequired,
            key: field.key ?? "", // Use the ID as the key
            comma_separated_options: field.options
                ? field.options.map((opt) => opt.value).join(",")
                : "", // Join options for dropdowns
        };
    });
    return convertedFields;
};
