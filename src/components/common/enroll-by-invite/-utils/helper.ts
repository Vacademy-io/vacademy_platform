import { getPublicUrlWithoutLogin } from "@/services/upload_file";

interface CourseMedia {
    type: string; // e.g., 'video', 'image', etc.
    id: string;
}

interface PaymentPlansInterface {
    value: number;
    unit: string;
    price: string;
    features: string[];
    title: string;
    newFeature: string;
}

export interface CourseDetailsJsonDataForInviteLink {
    course: string;
    description: string;
    learningOutcome: string;
    aboutCourse: string;
    targetAudience: string;
    coursePreview: string;
    courseBanner: string;
    courseMedia: CourseMedia;
    coursePreviewBlob: string;
    courseBannerBlob: string;
    courseMediaBlob: string;
    tags: string[];
    showRelatedCourses: boolean;
    includeInstituteLogo: boolean;
    includePaymentPlans: boolean;
    instituteLogoFileId: string;
    restrictToSameBatch: boolean;
    customHtml: string;
}

interface ConvertedCustomField {
    id: string;
    field_name: string;
    field_key: string;
    field_order: number;
    comma_separated_options: string;
    status: string;
    is_mandatory: boolean;
    field_type: string;
    created_at: string;
    updated_at: string;
}

interface CustomField {
    guestId: string | null;
    id: string;
    fieldKey: string;
    fieldName: string;
    fieldType: string; // e.g., 'textfield', 'dropdown', etc.
    defaultValue: string;
    config: string;
    formOrder: number;
    isMandatory: boolean;
    isFilter: boolean;
    isSortable: boolean;
    createdAt: string; // ISO date string
    updatedAt: string; // ISO date string
    sessionId: string;
    liveSessionId: string | null;
    customFieldValue: string | null;
}

interface EnrollInviteData {
    id: string;
    institute_id: string;
    type: string; // e.g., 'ENROLL_INVITE'
    type_id: string;
    custom_field: CustomField;
}

export interface PackageSessionData {
    package_session_id: string;
    id: string;
    payment_option: PaymentOption;
    enroll_invite_id: string | null;
    status: string | null;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string;
    source: string;
    source_id: string;
    tag: string | null;
    type: string;
    require_approval: boolean;
    payment_plans: PaymentPlan[];
    payment_option_metadata_json: string; // You can also parse this into PaymentOptionMetadata if needed
}

export interface PaymentPlan {
    id: string;
    name: string;
    status: string;
    validity_in_days: number;
    actual_price: number;
    elevated_price: number;
    currency: string;
    description: string;
    tag: string;
    feature_json: string; // raw stringified array, can be parsed to string[]
    referral_option: string | null;
    referral_option_smapping_status: string | null;
}

export const safeJsonParse = (
    jsonString: string | null | undefined,
    defaultValue: unknown = null
) => {
    if (!jsonString) return defaultValue;
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn("Failed to parse JSON:", jsonString, error);
        return defaultValue;
    }
};

export const transformApiDataToCourseDataForInvite = async (
    apiData: CourseDetailsJsonDataForInviteLink
) => {
    // Local cache for fileId -> publicUrl
    const fileUrlCache: Record<string, string> = {};

    async function getUrlOnce(
        fileId: string | null | undefined
    ): Promise<string> {
        if (!fileId) return "";
        if (fileUrlCache[fileId] !== undefined)
            return fileUrlCache[fileId] ?? "";
        const url = (await getPublicUrlWithoutLogin(fileId)) ?? "";
        fileUrlCache[fileId] = url;
        return url;
    }

    try {
        const courseMediaPreview =
            apiData.courseMedia?.type === "youtube"
                ? apiData.courseMedia.id
                : await getUrlOnce(apiData.courseMedia?.id);

        const coursePreviewImageMediaPreview = await getUrlOnce(
            apiData.coursePreview
        );
        const courseBannerMediaPreview = await getUrlOnce(apiData.courseBanner);
        const instituteLogo = await getUrlOnce(apiData.instituteLogoFileId);

        return {
            aboutCourse: apiData.aboutCourse,
            course: apiData.course,
            courseBanner: courseBannerMediaPreview,
            courseMediaId: {
                type: apiData.courseMedia.type,
                id: apiData.courseMedia.id,
            },
            courseMediaPreview: courseMediaPreview ?? "",
            coursePreview: coursePreviewImageMediaPreview,
            customHtml: apiData.customHtml,
            description: apiData.description,
            includeInstituteLogo: apiData.includeInstituteLogo,
            includePaymentPlans: apiData.includePaymentPlans,
            learningOutcome: apiData.learningOutcome,
            restrictToSameBatch: apiData.restrictToSameBatch,
            showRelatedCourses: apiData.showRelatedCourses,
            tags: apiData?.tags ?? [],
            targetAudience: apiData?.targetAudience ?? "",
            instituteLogo: instituteLogo || "",
        };
    } catch (error) {
        console.error("Error getting public URLs:", error);
        return null;
    }
};

export function convertInviteCustomFields(
    data: EnrollInviteData[]
): ConvertedCustomField[] {
    return data?.map((item) => {
        const field = item.custom_field;
        return {
            id: field.id,
            field_name: field.fieldName,
            field_key: field.fieldKey,
            field_order: field.formOrder,
            comma_separated_options:
                field.fieldType === "dropdown"
                    ? JSON.parse(field.config)?.coommaSepartedOptions
                    : "",
            status: "ACTIVE",
            is_mandatory: field.isMandatory,
            field_type: field.fieldType,
            created_at: field.createdAt,
            updated_at: field.updatedAt,
        };
    });
}

export function convertPlansToPaymentOptions(rawPlans: PackageSessionData) {
    const paymentOption = rawPlans.payment_option;
    const unit = JSON.parse(paymentOption.payment_option_metadata_json)?.unit;
    return paymentOption?.payment_plans?.map((plan) => {
        let features: string[];

        try {
            const parsed = JSON.parse(plan.feature_json);
            features = Array.isArray(parsed) && parsed.length > 0 ? parsed : []; // fallback
        } catch {
            features = []; // fallback
        }

        return {
            id: plan.id,
            name: plan.name,
            amount: plan.actual_price,
            currency: plan.currency,
            description: plan.description,
            duration:
                unit === "days"
                    ? plan.validity_in_days + " days"
                    : Math.floor(plan.validity_in_days / 30) + " months",
            features,
        };
    });
}

export function getDefaultPlanFromPaymentsData(item: PaymentOption) {
    const parsedData = JSON.parse(item.payment_option_metadata_json);
    if (item.type === "donation") {
        return {
            id: item.id,
            name: item.name,
            description: "Access to donation plan.",
            suggestedAmount:
                parsedData?.donationData?.suggestedAmounts
                    ?.split(",")
                    ?.map((x: string) => Number(x.trim())) || [],
            minAmount: Number(parsedData?.donationData?.minimumAmount) || 0,
            currency: parsedData?.currency || "",
            type: item.type,
        };
    } else if (
        item.type === "free" ||
        item.type === "FREE" ||
        item.type === "Free"
    ) {
        return {
            id: item.id,
            name: item.name,
            description: "Access to free plan.",
            days: parsedData?.freeData?.validityDays || 0,
            type: item.type,
        };
    } else if (item.type === "upfront") {
        return {
            id: item.id,
            name: item.name,
            description: "Access to one time payment plan.",
            price: parsedData?.upfrontData?.fullPrice || "",
            currency: parsedData?.currency || "",
            type: item.type,
        };
    } else {
        return {
            id: item.id,
            name: item.name,
            description: "Access to subscription plan.",
            currency: parsedData?.currency || "",
            type: item.type,
            paymentOption:
                parsedData?.subscriptionData?.customIntervals.map(
                    (interval: PaymentPlansInterface) => {
                        return {
                            value: interval.value || 0,
                            unit: interval.unit || "",
                            price: interval.price || "",
                            features: interval.features || [],
                            title: interval.title || "",
                            newFeature: interval.newFeature || "",
                        };
                    }
                ) || [],
        };
    }
}
