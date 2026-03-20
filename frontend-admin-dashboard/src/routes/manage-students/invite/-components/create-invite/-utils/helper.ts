import { getInstituteId } from '@/constants/helper';
import { InviteLinkFormValues } from '../GenerateInviteLinkSchema';
import { CustomField } from '../../../-schema/InviteFormSchema';
import { IndividualInviteLinkDetails } from '@/types/study-library/individual-invite-interface';
import { PaymentPlanApi } from '@/types/payment';

interface DropdownOptionForConversion {
    id: number | string;
    value: string;
    disabled?: boolean;
}

interface CustomFieldForConversion {
    id: number | string;
    type: string;
    name: string;
    oldKey: boolean;
    isRequired: boolean;
    options?: DropdownOptionForConversion[];
    key?: string;
    order?: number;
}

export interface ReferralData {
    id: string;
    name: string;
    status: string; // Add more status types if applicable
    source: string; // Adjust as needed
    source_id: string;
    referrer_discount_json: string;
    referee_discount_json: string;
    referrer_vesting_days: number;
    tag: string;
    description: string;
    created_at: string; // Consider `Date` if you parse it
    updated_at: string; // Consider `Date` if you parse it
}

type ApiCourseData = {
    course: {
        id: string;
        package_name: string;
    };
    sessions: {
        session_dto: {
            id: string;
            session_name: string;
        };
        level_with_details: {
            id: string;
            name: string;
        }[];
    }[];
};

type FreePlan = {
    id: string;
    name: string;
    description: string;
    days?: number;
    suggestedAmount?: number[];
    minAmount?: number;
    currency?: string;
    type?: string;
};

interface PaidPlan {
    id: string;
    name: string;
    description: string;
    price?: string;
    type?: string;
    currency?: string;
    paymentOption?: {
        value: number;
        unit: string;
        price: string;
        features: string[];
        title: string;
        newFeature: string;
    }[];
}

export interface Course {
    id: string;
    name: string;
}

export interface Batch {
    sessionId: string;
    levelId: string;
    sessionName: string;
    levelName: string;
    courseId: string;
    courseName: string;
    isParent?: boolean;
}

export interface PaymentOption {
    id: string;
    name: string;
    status: string; // add more status types if needed
    source: string; // update with other possible sources
    source_id: string;
    tag: string; // restrict more if tag values are known
    type: string; // assuming these are the possible types
    require_approval: boolean;
    payment_plans: PaymentPlanApi[]; // Payment plans array
    payment_option_metadata_json: string; // or parsed as: PaymentOptionMetadata if you want to parse it
}

interface PaymentPlansInterface {
    value: number;
    unit: string;
    price: string;
    features: string[];
    title: string;
    newFeature: string;
}

export function transformApiDataToDummyStructure(data: ApiCourseData[]) {
    const dummyCourses: { id: string; name: string }[] = [];
    const dummyBatches: Record<
        string,
        {
            sessionId: string;
            sessionName: string;
            levels: {
                levelId: string;
                levelName: string;
            }[];
        }[]
    > = {};

    data.forEach((courseItem) => {
        const courseId = courseItem.course.id;
        const courseName = courseItem.course.package_name;

        // Add to dummyCourses
        dummyCourses.push({
            id: courseId,
            name: courseName,
        });

        // Prepare sessions for dummyBatches
        const sessions = courseItem.sessions.map((sessionItem) => ({
            sessionId: sessionItem.session_dto.id,
            sessionName: sessionItem.session_dto.session_name,
            levels: sessionItem.level_with_details.map((lvl) => ({
                levelId: lvl.id,
                levelName: lvl.name,
            })),
        }));

        dummyBatches[courseId] = sessions;
    });

    return { dummyCourses, dummyBatches };
}

function transformCustomFields(customFields: CustomField[], instituteId: string) {
    const toSnakeCase = (str: string | null | undefined) =>
        (str ?? '')
            .trim()
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/([a-z])([A-Z])/g, '$1_$2') // Add underscore between camelCase transitions
            .toLowerCase();
    return customFields.map((field, index) => {
        const isDropdown = field.type === 'dropdown';
        const options = isDropdown ? field.options?.map((opt) => opt.value).join(',') : '';

        return {
            // Only set id (mapping ID) if _id (custom field ID) is present, indicating an existing field
            // For new fields, id should be empty so the backend can create a new mapping
            id: field._id ? (field.id || '') : '',
            institute_id: instituteId,
            type: field.type,
            type_id: '',
            custom_field: {
                guestId: '',
                id: field._id || '', // Use _id for the custom field ID (custom_field.id)
                fieldKey: toSnakeCase(field.name),
                fieldName: field.name,
                fieldType: field.type,
                defaultValue: '',
                config: isDropdown ? JSON.stringify({ coommaSepartedOptions: options }) : '',
                formOrder: index,
                isMandatory: field.isRequired,
                isFilter: true,
                isSortable: true,
                createdAt: '',
                updatedAt: '',
                sessionId: '',
                liveSessionId: '',
                customFieldValue: '',
            },
        };
    });
}

function safeJsonParse<T = unknown>(str: string, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

export function ReTransformCustomFields(inviteDetails: IndividualInviteLinkDetails) {
    return inviteDetails?.institute_custom_fields?.map((field, index) => {
        const config = safeJsonParse<{ coommaSepartedOptions?: string }>(
            field.custom_field.config,
            {}
        );

        // Convert options to the new format with id, value, and disabled
        const options = config.coommaSepartedOptions
            ? config.coommaSepartedOptions.split(',').map((option: string, optIndex: number) => ({
                  id: String(optIndex),
                  value: option.trim(),
                  disabled: true,
              }))
            : undefined;

        return {
            id: field.id, // Preserve the mapping ID (InstituteCustomField.id)
            type: field.type,
            name: field.custom_field.fieldName,
            oldKey: false,
            isRequired: field.custom_field.isMandatory,
            key: field.custom_field.fieldName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, ''),
            order: index,
            _id: field.custom_field.id, // Preserve the custom field ID (custom_field.id)
            ...(options && { options }),
        };
    });
}

export function convertInviteData(
    data: InviteLinkFormValues,
    selectedCourse: Course | null,
    selectedBatches: Batch[],
    getPackageSessionId: ({
        courseId,
        levelId,
        sessionId,
    }: {
        courseId: string;
        levelId: string;
        sessionId: string;
    }) => void,
    paymentPlans: PaymentOption[],
    referralProgramDetails: ReferralData[],
    instituteLogoFileId: string,
    inviteId?: string,
    existingInviteDetails?: IndividualInviteLinkDetails | null
) {
    const instituteId = getInstituteId();
    const isBundle = selectedBatches.length > 1;
    const jsonMetaData = {
        course: data.course,
        description: data.description,
        learningOutcome: data.learningOutcome,
        aboutCourse: data.aboutCourse,
        targetAudience: data.targetAudience,
        coursePreview: data.coursePreview,
        courseBanner: data.courseBanner,
        courseMedia: data.courseMedia,
        coursePreviewBlob: data.coursePreviewBlob,
        courseBannerBlob: data.courseBannerBlob,
        courseMediaBlob: data.courseMediaBlob,
        tags: data.tags,
        showRelatedCourses: data.showRelatedCourses,
        includeInstituteLogo: data.includeInstituteLogo,
        instituteLogoFileId: instituteLogoFileId,
        restrictToSameBatch: data.restrictToSameBatch,
        includePaymentPlans: data.includePaymentPlans,
        customHtml: data.customHtml,
    };

    // Create package_session_to_payment_options for all batches

    const packageSessionToPaymentOptions = selectedBatches.map((batch) => {
        const packageSessionId = getPackageSessionId({
            courseId: batch.courseId,
            levelId: batch.levelId,
            sessionId: batch.sessionId,
        });

        return {
            package_session_id: packageSessionId,
            payment_option: getMatchingPaymentAndReferralPlanForAPIs(
                paymentPlans,
                data.selectedPlan?.id || '',
                referralProgramDetails,
                data.planReferralMappings
            ),
        };
    });

    const convertedData = {
        id: inviteId || '',
        name: data.name,
        start_date: '',
        end_date: '',
        invite_code: '',
        status: 'ACTIVE',
        institute_id: instituteId,
        vendor: existingInviteDetails?.vendor || 'STRIPE',
        vendor_id: existingInviteDetails?.vendor_id || 'STRIPE',
        currency: '',
        tag: '',
        is_bundled: isBundle,
        learner_access_days:
            data.selectedPlan?.type?.toLowerCase() === 'subscription'
                ? data.accessDurationDays
                : null,
        web_page_meta_data_json: JSON.stringify(jsonMetaData),
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        institute_custom_fields: transformCustomFields(data.custom_fields, instituteId || ''),
        package_session_to_payment_options: packageSessionToPaymentOptions,
    };
    return convertedData;
}

export function splitPlansByType(data: PaymentOption[]): {
    freePlans: FreePlan[];
    paidPlans: PaidPlan[];
} {
    const freePlans: FreePlan[] = [];
    const paidPlans: PaidPlan[] = [];

    data.forEach((item) => {
        const type = (item.type ?? '').toLowerCase();
        if (!type) return;
        if (type === 'free' || type === 'donation') {
            const parsedData = JSON.parse(item.payment_option_metadata_json);
            if (type === 'donation') {
                freePlans.push({
                    id: item.id,
                    name: item.name,
                    description: 'Access to donation plan.',
                    suggestedAmount:
                        parsedData?.donationData?.suggestedAmounts
                            ?.split(',')
                            ?.map((x: string) => Number(x.trim())) || [],
                    minAmount: Number(parsedData?.donationData?.minimumAmount) || 0,
                    currency: parsedData?.currency || '',
                    type: item.type,
                });
            } else {
                freePlans.push({
                    id: item.id,
                    name: item.name,
                    description: 'Access to free plan.',
                    days: parsedData?.freeData?.validityDays || 0,
                    type: item.type,
                });
            }
        } else {
            const parsedData = JSON.parse(item.payment_option_metadata_json);
            if (type === 'upfront' || type === 'one_time') {
                paidPlans.push({
                    id: item.id,
                    name: item.name,
                    description: 'Access to one time payment plan.',
                    price: parsedData?.upfrontData?.fullPrice || '',
                    currency: parsedData?.currency || '',
                    type: item.type,
                });
            } else {
                paidPlans.push({
                    id: item.id,
                    name: item.name,
                    description: 'Access to subscription plan.',
                    currency: parsedData?.currency || '',
                    type: item.type,
                    paymentOption:
                        parsedData?.subscriptionData?.customIntervals.map(
                            (interval: PaymentPlansInterface) => {
                                return {
                                    value: interval.value || 0,
                                    unit: interval.unit || '',
                                    price: interval.price || '',
                                    features: interval.features || [],
                                    title: interval.title || '',
                                    newFeature: interval.newFeature || '',
                                };
                            }
                        ) || [],
                });
            }
        }
    });

    return { freePlans, paidPlans };
}

export function getDefaultPlanFromPaymentsData(data: PaymentOption[]) {
    const item = data.find((item) => item.tag === 'DEFAULT');
    if (!item)
        return {
            id: '',
            name: '',
            days: 0,
            suggestedAmount: [],
            minAmount: 0,
            currency: '',
            price: '',
            paymentOption: [],
            type: '',
        };
    const parsedData = JSON.parse(item.payment_option_metadata_json);
    const type = (item.type ?? '').toLowerCase();
    if (type === 'donation') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to donation plan.',
            suggestedAmount:
                parsedData?.donationData?.suggestedAmounts
                    ?.split(',')
                    ?.map((x: string) => Number(x.trim())) || [],
            minAmount: Number(parsedData?.donationData?.minimumAmount) || 0,
            currency: parsedData?.currency || '',
            type: item.type,
        };
    } else if (type === 'free') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to free plan.',
            days: parsedData?.freeData?.validityDays || 0,
            type: item.type,
        };
    } else if (type === 'upfront' || type === 'one_time') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to one time payment plan.',
            price: parsedData?.upfrontData?.fullPrice || '',
            currency: parsedData?.currency || '',
            type: item.type,
        };
    } else {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to subscription plan.',
            currency: parsedData?.currency || '',
            type: item.type,
            paymentOption:
                parsedData?.subscriptionData?.customIntervals.map(
                    (interval: PaymentPlansInterface) => {
                        return {
                            value: interval.value || 0,
                            unit: interval.unit || '',
                            price: interval.price || '',
                            features: interval.features || [],
                            title: interval.title || '',
                            newFeature: interval.newFeature || '',
                        };
                    }
                ) || [],
        };
    }
}

export function getMatchingPaymentPlan(data: PaymentOption[], id: string) {
    const item = data.find((item) => item.id === id);
    if (!item)
        return {
            id: '',
            name: '',
            days: 0,
            suggestedAmount: [],
            minAmount: 0,
            currency: '',
            price: '',
            paymentOption: [],
            type: '',
        };
    const parsedData = JSON.parse(item.payment_option_metadata_json);
    const type = (item.type ?? '').toLowerCase();
    if (type === 'donation') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to donation plan.',
            suggestedAmount:
                parsedData?.donationData?.suggestedAmounts
                    ?.split(',')
                    ?.map((x: string) => Number(x.trim())) || [],
            minAmount: Number(parsedData?.donationData?.minimumAmount) || 0,
            currency: parsedData?.currency || '',
            type: item.type,
        };
    } else if (type === 'free') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to free plan.',
            days: parsedData?.freeData?.validityDays || 0,
            type: item.type,
        };
    } else if (type === 'upfront' || type === 'one_time') {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to one time payment plan.',
            price: parsedData?.upfrontData?.fullPrice || '',
            currency: parsedData?.currency || '',
            type: item.type,
        };
    } else {
        return {
            id: item.id,
            name: item.name,
            description: 'Access to subscription plan.',
            currency: parsedData?.currency || '',
            type: item.type,
            paymentOption:
                parsedData?.subscriptionData?.customIntervals.map(
                    (interval: PaymentPlansInterface) => {
                        return {
                            value: interval.value || 0,
                            unit: interval.unit || '',
                            price: interval.price || '',
                            features: interval.features || [],
                            title: interval.title || '',
                            newFeature: interval.newFeature || '',
                        };
                    }
                ) || [],
        };
    }
}

export function getMatchingPaymentAndReferralPlanForAPIs(
    data: PaymentOption[],
    id: string,
    referralProgramDetails: ReferralData[],
    planReferralMappings: Record<string, string> // planId -> referralId mapping
) {
    const item = data.find((item) => item.id === id);

    // If it's a subscription plan, we need to handle multiple payment options
    if (item?.type?.toLowerCase() === 'subscription') {
        const parsedData = JSON.parse(item.payment_option_metadata_json || '{}');
        const customIntervals = parsedData?.subscriptionData?.customIntervals || [];

        // Map each subscription interval to have its own referral
        const updatedIntervals = customIntervals.map(
            (interval: PaymentPlansInterface, index: number) => {
                const planId = `${item.id}_option_${index}`;
                const referralId = planReferralMappings[planId];
                const referralProgram = referralId
                    ? referralProgramDetails.find((ref) => ref.id === referralId)
                    : null;

                return {
                    ...interval,
                    referral_option: referralProgram || null,
                };
            }
        );

        // Update the metadata with referral options
        const updatedMetadata = {
            ...parsedData,
            subscriptionData: {
                ...parsedData.subscriptionData,
                customIntervals: updatedIntervals,
            },
        };

        return {
            ...item,
            payment_option_metadata_json: JSON.stringify(updatedMetadata),
            payment_plans: item?.payment_plans?.map((plan) => {
                // For subscription plans, the main payment plan gets the first option's referral
                const firstPlanId = `${item.id}_option_0`;
                const referralId = planReferralMappings[firstPlanId];
                const referralProgram = referralId
                    ? referralProgramDetails.find((ref) => ref.id === referralId)
                    : null;

                return {
                    ...plan,
                    referral_option: referralProgram || null,
                };
            }),
        };
    } else {
        // For other plan types (free, one_time, upfront, donation)
        return {
            ...item,
            payment_plans: item?.payment_plans?.map((plan) => {
                const planId = item.id;
                const referralId = planReferralMappings[planId];
                const referralProgram = referralId
                    ? referralProgramDetails.find((ref) => ref.id === referralId)
                    : null;

                return {
                    ...plan,
                    referral_option: referralProgram || null,
                };
            }),
        };
    }
}

export function getPaymentOptionBySessionId(
    data: IndividualInviteLinkDetails,
    targetSessionId: string | null
) {
    return (
        data?.package_session_to_payment_options?.find(
            (item) => item.package_session_id === targetSessionId
        ) || null
    );
}

export function convertReferralData(data: ReferralData[]) {
    if (!data) return [];

    // Import the conversion logic from the referral service
    const convertFromApiFormat = (apiResponse: ReferralData) => {
        try {
            const referrerDiscountData = JSON.parse(apiResponse.referrer_discount_json);
            const refereeDiscountData = JSON.parse(apiResponse.referee_discount_json);

            // Helper function to convert new tier format to referee reward
            const convertNewTierFormatToRefereeReward = (tierData: Record<string, unknown>) => {
                const tiers = tierData.tiers as Array<Record<string, unknown>>;
                if (tiers && tiers[0]) {
                    const firstTier = tiers[0];
                    const benefits = firstTier.benefits as Array<Record<string, unknown>>;
                    if (benefits && benefits[0]) {
                        return convertBenefitToReward(benefits[0]);
                    }
                }

                // Fallback to default
                return {
                    type: 'discount_percentage',
                    value: 10,
                    currency: 'USD',
                };
            };

            // Helper function to convert new tier format to referrer rewards
            const convertNewTierFormatToReferrerRewards = (tierData: Record<string, unknown>) => {
                const tiers = tierData.tiers as Array<Record<string, unknown>>;
                if (tiers && Array.isArray(tiers)) {
                    return tiers.map((tier) => {
                        const benefits = tier.benefits as Array<Record<string, unknown>>;
                        const benefit = benefits && benefits[0] ? benefits[0] : null;

                        const referralRange = tier.referralRange as Record<string, unknown>;

                        // Convert to the simplified format expected by the form
                        return {
                            referralCount: (referralRange?.min as number) || 1,
                            type: benefit ? getBenefitType(benefit) : 'discount_percentage',
                        };
                    });
                }
                return [];
            };

            // Helper function to convert benefit to reward (with enhanced fields but fallback to form schema)
            const convertBenefitToReward = (benefit: Record<string, unknown>) => {
                const benefitValue = benefit.value as Record<string, unknown>;
                const type = getBenefitType(benefit);

                const reward = {
                    type,
                    value: getRewardValue(benefit, benefitValue, type),
                    currency: 'INR',
                    // Enhanced fields for display (will be preserved but form schema only requires the basic structure)
                    ...(type === 'bonus_content' && {
                        contentType: (benefitValue?.contentUrl as string) ? 'link' : 'upload',
                        contentUrl: benefitValue?.contentUrl as string,
                        fileIds: benefitValue?.fileIds as string[],
                        template: benefitValue?.templateId as string,
                        title: (benefit.description as string) || 'Bonus Content',
                    }),
                    ...(type === 'points_system' && {
                        pointsPerReferral: (benefitValue?.points as number) || 0,
                        pointTriggers:
                            (benefit.pointTriggers as Array<Record<string, unknown>>) || [],
                    }),
                };

                return reward;
            };

            // Helper function to get benefit type
            const getBenefitType = (benefit: Record<string, unknown>) => {
                switch (benefit.type) {
                    case 'PERCENTAGE_DISCOUNT':
                        return 'discount_percentage';
                    case 'FLAT_DISCOUNT':
                        return 'discount_fixed';
                    case 'FREE_MEMBERSHIP_DAYS':
                        return 'free_days';
                    case 'CONTENT':
                        return 'bonus_content';
                    case 'POINTS':
                        return 'points_system';
                    default:
                        return 'discount_percentage';
                }
            };

            // Helper function to get reward value
            const getRewardValue = (
                benefit: Record<string, unknown>,
                benefitValue: Record<string, unknown>,
                type: string
            ) => {
                switch (type) {
                    case 'discount_percentage':
                        return (benefitValue?.percentage as number) || 0;
                    case 'discount_fixed':
                        return (benefitValue?.amount as number) || 0;
                    case 'free_days':
                        return (benefitValue?.days as number) || 0;
                    case 'points_system':
                        return (benefitValue?.points as number) || 0;
                    case 'bonus_content':
                        return 0; // Content benefits don't have a numeric value
                    default:
                        return 10;
                }
            };

            // Handle referee reward - convert from new tier-based format
            const refereeReward = convertNewTierFormatToRefereeReward(refereeDiscountData);

            // Handle referrer rewards - convert from new tier-based format
            const referrerRewards = convertNewTierFormatToReferrerRewards(referrerDiscountData);

            return {
                id: apiResponse.id,
                name: apiResponse.name,
                refereeBenefit: refereeReward,
                referrerBenefit: referrerRewards,
                vestingPeriod: apiResponse.referrer_vesting_days,
                combineOffers: true,
            };
        } catch (error) {
            console.error('Error parsing referral option data:', error);
            // Return fallback data
            return {
                id: apiResponse.id,
                name: apiResponse.name,
                refereeBenefit: {
                    type: 'discount_percentage',
                    value: 10,
                    currency: 'USD',
                },
                referrerBenefit: [],
                vestingPeriod: apiResponse.referrer_vesting_days || 0,
                combineOffers: true,
            };
        }
    };

    return data.map(convertFromApiFormat);
}

export function getDefaultMatchingReferralData(data: ReferralData[]) {
    const item = data.find((item) => item.tag === 'DEFAULT');
    if (!item)
        return {
            id: '',
            name: '',
            refereeBenefit: {
                type: '',
                value: 0,
                currency: '',
            },
            referrerBenefit: [
                {
                    referralCount: 0,
                    type: '',
                },
            ],
            vestingPeriod: 0,
            combineOffers: false,
        };

    // Use the same conversion logic as convertReferralData
    const convertedData = convertReferralData([item]);
    return (
        convertedData[0] || {
            id: item.id,
            name: item.name,
            refereeBenefit: {
                type: '',
                value: 0,
                currency: '',
            },
            referrerBenefit: [],
            vestingPeriod: item.referrer_vesting_days || 0,
            combineOffers: true,
        }
    );
}

interface SelectedPlan {
    id: string;
    name: string;
    paymentOption?: {
        title: string;
        price: string;
        value: number;
        unit: string;
        features: string[];
        newFeature: string;
    }[];
    type?: string;
}

// Helper function to extract all plan IDs from a selected plan for referral mapping
export function getAllPlanIdsFromSelectedPlan(selectedPlan: SelectedPlan | null): string[] {
    if (!selectedPlan) return [];

    const planIds: string[] = [];

    // For subscription plans with multiple payment options
    if (selectedPlan.paymentOption && Array.isArray(selectedPlan.paymentOption)) {
        selectedPlan.paymentOption.forEach((_, index: number) => {
            // Generate a unique ID for each payment option
            planIds.push(`${selectedPlan.id}_option_${index}`);
        });
    } else {
        // For other plan types (free, one_time, upfront, donation)
        planIds.push(selectedPlan.id);
    }

    return planIds;
}

// Helper function to get plan display name
export function getPlanDisplayName(selectedPlan: SelectedPlan | null, planId: string): string {
    if (!selectedPlan) return '';

    // For subscription plans with multiple payment options
    if (selectedPlan.paymentOption && Array.isArray(selectedPlan.paymentOption)) {
        const parts = planId.split('_option_');
        if (parts.length === 2 && parts[1]) {
            const optionIndex = parseInt(parts[1]);
            const option = selectedPlan.paymentOption[optionIndex];
            return option?.title || `${selectedPlan.name} - Option ${optionIndex + 1}`;
        }
    }

    // For other plan types
    return selectedPlan.name;
}

export function convertRegistrationFormData(data: CustomFieldForConversion[]) {
    const now = new Date().toISOString();
    const transformedData = data.map((field: CustomFieldForConversion) => ({
        comma_separated_options:
            field.type === 'dropdown'
                ? field.options?.map((opt: DropdownOptionForConversion) => opt.value).join(',') ||
                  ''
                : '',
        created_at: now,
        field_key: field.key || (field.name ?? '').toLowerCase().replace(/\s+/g, '_'),
        field_name: field.name,
        field_order: field.order ?? 0,
        field_type: field.type,
        id: field.id.toString(),
        is_mandatory: field.isRequired || false,
        status: 'ACTIVE',
        updated_at: now,
    }));
    return transformedData;
}
