import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ai-course-builder/LoadingSpinner';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form } from '@/components/ui/form';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useRef } from 'react';
import { useForm as useDiscountForm } from 'react-hook-form';
import { zodResolver as discountZodResolver } from '@hookform/resolvers/zod';
import {
    AddDiscountFormValues,
    addDiscountSchema,
    GenerateInviteLinkDialogProps,
    InviteLinkFormValues,
    inviteLinkSchema,
} from './GenerateInviteLinkSchema';
import { PaymentPlansDialog } from './PaymentPlansDialog';
import AddPaymentPlanDialog from './AddPaymentPlanDialog';
import { DiscountSettingsDialog } from './DiscountSettingsDialog';
import { AddDiscountDialog } from './AddDiscountDialog';
import { AddReferralProgramDialog } from './AddReferralProgramDialog';
import { ReferralProgramDialog } from './ReferralProgramDialog';
import InstituteBrandingCard from './-components/InstituteBrandingCard';
import CoursePreviewCard from './-components/CoursePreviewCard';
import PaymentPlanCard from './-components/PaymentPlanCard';
import AutopaySettingsCard from './-components/AutopaySettingsCard';
import { getInviteListCustomFields, getInviteListCustomFieldsAsync } from '../../-utils/getInviteListCustomFields';
import PlanReferralMappingCard from './-components/PlanReferralMappingCard';
import { PlanReferralConfigDialog } from './PlanReferralConfigDialog';
import RestrictSameBatch from './-components/RestrictSameBatch';
import CustomInviteFormCard from './-components/CustomInviteFormCard';
import LearnerAccessDurationCard from './-components/LearnerAccessDurationCard';
import CustomHTMLCard from './-components/CustomHTMLCard';
import PostFormFillConfigurationCard from './-components/PostFormFillConfigurationCard';
import SubOrgSettingsCard from './-components/SubOrgSettingsCard';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { handleEnrollInvite, handleGetEnrollSingleInviteDetails } from './-services/enroll-invite';
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSTITUTE_VENDORS } from '@/constants/urls';
import { handleGetPaymentDetails } from './-services/get-payments';
import { useUpdateInvite } from '../../-services/update-invite';
import InviteNameCard from './-components/InviteNameCard';
import { useStudyLibraryStore } from '@/stores/study-library/use-study-library-store';
import { transformApiDataToCourseDataForInvite } from '@/routes/study-library/courses/course-details/-utils/helper';
import {
    convertInviteData,
    getMatchingPaymentPlan,
    getPaymentOptionBySessionId,
    ReTransformCustomFields,
    splitPlansByType,
} from './-utils/helper';
import { handleGetReferralProgramDetails } from './-services/referral-services';
import PreviewInviteLink from './PreviewInviteLink';
import useInstituteLogoStore from '@/components/common/layout-container/sidebar/institutelogo-global-zustand';
import createInviteLink from '../../-utils/createInviteLink';
import { Copy } from '@phosphor-icons/react';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

const GenerateInviteLinkDialog = ({
    showSummaryDialog,
    setShowSummaryDialog,
    selectedCourse,
    selectedBatches,
    inviteLinkId,
    singlePackageSessionId,
    isEditInviteLink,
    setDialogOpen,
    selectCourseForm,
}: GenerateInviteLinkDialogProps) => {
    const { instituteLogo } = useInstituteLogoStore();
    const { data: inviteLinkDetails } = useSuspenseQuery(
        singlePackageSessionId && inviteLinkId
            ? handleGetEnrollSingleInviteDetails({ inviteId: inviteLinkId })
            : {
                queryKey: ['empty-invite-details'],
                queryFn: () => null,
            }
    );
    const { data: referralProgramDetails } = useSuspenseQuery(handleGetReferralProgramDetails());
    const { data: paymentsData } = useSuspenseQuery(handleGetPaymentDetails());
    const { studyLibraryData } = useStudyLibraryStore();

    // Find parent batch (first batch if none explicitly marked as parent)
    const parentBatch = selectedBatches.find((batch) => batch.isParent) || selectedBatches[0];
    const isBundle = selectedBatches.length > 1;

    const lookupCourseId = parentBatch?.courseId || selectedCourse?.id;
    const courseDetailsData =
        studyLibraryData?.find((item) => item.course.id === lookupCourseId) ??
        studyLibraryData?.find((item) =>
            Array.isArray(item.package_sessions)
                ? item.package_sessions.some((ps) => ps.id === lookupCourseId)
                : false
        );

    const queryClient = useQueryClient();

    // When the dialog opens, ensure studyLibraryData is fresh so that
    // course-level fields edited recently (description, tags, preview/banner
    // media, course media) are reflected in the invite-link preview.
    useEffect(() => {
        if (!showSummaryDialog) return;
        queryClient.invalidateQueries({ queryKey: ['GET_INIT_STUDY_LIBRARY'] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSummaryDialog]);
    const form = useForm<InviteLinkFormValues>({
        resolver: zodResolver(inviteLinkSchema),
        defaultValues: {
            name: '',
            includeInstituteLogo: false,
            includePaymentPlans: true,
            requireApproval: false,
            course: '',
            description: '',
            learningOutcome: '',
            aboutCourse: '',
            targetAudience: '',
            coursePreview: '',
            courseBanner: '',
            courseMedia: { type: '', id: '' },
            coursePreviewBlob: '',
            courseBannerBlob: '',
            courseMediaBlob: '',
            tags: [],
            custom_fields: getInviteListCustomFields(),
            uploadingStates: {
                coursePreview: false,
                courseBanner: false,
                courseMedia: false,
            },
            youtubeUrl: '',
            youtubeError: '',
            showYoutubeInput: false,
            showMediaMenu: false,
            freePlans: [],
            paidPlans: [],
            showPlansDialog: false,
            selectedPlan: {},
            showAddPlanDialog: false,
            showDiscountDialog: false,
            discounts: [],
            showAddDiscountDialog: false,
            selectedDiscountId: 'none',
            referralPrograms: [],
            selectedReferralId: 'r1',
            showReferralDialog: false,
            showAddReferralDialog: false,
            // New per-plan referral fields
            planReferralMappings: {},
            selectedPlanForReferral: '',
            showPlanReferralDialog: false,
            restrictToSameBatch: false,
            accessDurationType: 'define',
            accessDurationDays: '',
            inviteeEmail: '',
            inviteeEmails: [],
            customHtml: '',
            showRelatedCourses: false,
            selectedOptionValue: 'textfield',
            textFieldValue: '',
            dropdownOptions: [],
            isDialogOpen: false,
            postformfillConfiguration: {
                redirectPath: '',
                showLoginButton: true,
                content: '',
                collectBillingContactDetails: false,
            },
        },
    });

    form.watch('custom_fields');

    const { control, setValue, getValues, handleSubmit } = form;
    const { fields: customFieldsArray } = useFieldArray({
        control,
        name: 'custom_fields',
    });
    const customFields = getValues('custom_fields');

    // Each time the dialog OPENS in create mode: fetch fresh custom field
    // defaults from the API and seed the form. This must re-run on every open
    // (not just on mount) because on the course-details page this dialog is
    // permanently mounted and reused — after a create (form.reset wipes
    // custom_fields to []) or after viewing another invite (which loads that
    // invite's smaller field set), a one-time seed would leave the next "Add"
    // with stale/empty custom fields. Uses form.reset to ensure useFieldArray
    // picks up the change. The `...currentValues` spread preserves every other
    // field the create-mode effect may have already populated (course data,
    // plans, etc.).
    useEffect(() => {
        if (!isEditInviteLink && showSummaryDialog) {
            getInviteListCustomFieldsAsync().then((fields) => {
                if (fields && fields.length > 0) {
                    const currentValues = form.getValues();
                    form.reset({ ...currentValues, custom_fields: fields });
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSummaryDialog, isEditInviteLink]);

    const { instituteDetails, getPackageSessionId } = useInstituteDetailsStore();
    const allTags = instituteDetails?.tags || [];
    const INSTITUTE_ID = getCurrentInstituteId();

    const { data: instituteVendorsList = [] } = useQuery<
        { vendor: string; vendor_id: string }[]
    >({
        queryKey: ['institute-vendors', INSTITUTE_ID],
        queryFn: async () => {
            const response = await authenticatedAxiosInstance.get(
                `${GET_INSTITUTE_VENDORS}?instituteId=${INSTITUTE_ID}`
            );
            return response.data;
        },
        enabled: !!INSTITUTE_ID,
        staleTime: 5 * 60 * 1000,
    });
    const instituteVendor = instituteVendorsList[0] ?? null;

    // Helper function to safely parse JSON
    const safeJsonParse = (jsonString: string | null | undefined, defaultValue: unknown = null) => {
        if (!jsonString) return defaultValue;
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse JSON:', jsonString, error);
            return defaultValue;
        }
    };

    const { uploadFile, getPublicUrl } = useFileUpload();

    const coursePreviewRef = useRef<HTMLInputElement>(null);
    const courseBannerRef = useRef<HTMLInputElement>(null);
    const courseMediaRef = useRef<HTMLInputElement>(null);
    const mediaMenuRef = useRef<HTMLDivElement>(null);
    const youtubeInputRef = useRef<HTMLDivElement>(null);

    const updateInviteMutation = useUpdateInvite();

    const handleSubmitInviteLinkMutation = useMutation({
        mutationFn: async ({ data }: { data: InviteLinkFormValues }) => {
            const convertedData = convertInviteData(
                data,
                selectedCourse,
                selectedBatches,
                getPackageSessionId,
                paymentsData,
                referralProgramDetails,
                instituteDetails?.institute_logo_file_id || '',
                inviteLinkId,
                inviteLinkDetails,
                instituteVendor
            );

            if (isEditInviteLink && inviteLinkId) {
                // Use useUpdateInvite for editing
                return updateInviteMutation.mutateAsync({ requestBody: convertedData });
            } else {
                // Use handleEnrollInvite for creating
                return handleEnrollInvite({
                    data,
                    selectedCourse,
                    selectedBatches,
                    getPackageSessionId,
                    paymentsData,
                    referralProgramDetails,
                    instituteLogoFileId: instituteDetails?.institute_logo_file_id || '',
                    instituteVendor,
                });
            }
        },
        onSuccess: () => {
            form.setValue('showAddPlanDialog', false);
            queryClient.invalidateQueries({ queryKey: ['GET_INVITE_LINKS'] });
            queryClient.invalidateQueries({ queryKey: ['inviteList'] });
            toast.success(
                isEditInviteLink
                    ? 'Your invite link has been updated successfully!'
                    : 'Your invite link has been created successfully!',
                {
                    className: 'success-toast',
                    duration: 2000,
                }
            );
            form.reset();
            selectCourseForm?.reset();
            setShowSummaryDialog(false);
            setDialogOpen?.(false);
        },
        onError: (error: unknown) => {
            if (error instanceof AxiosError) {
                console.error('API Error Response:', {
                    status: error.response?.status,
                    data: error.response?.data,
                    message: error.message,
                    config: {
                        method: error.config?.method,
                        url: error.config?.url,
                        data: error.config?.data,
                    },
                });
                toast.error(
                    error?.response?.data?.ex ||
                    error?.response?.data?.message ||
                    'Failed to save invite link',
                    {
                        className: 'error-toast',
                        duration: 3000,
                    }
                );
            } else {
                toast.error('An unexpected error occurred', {
                    className: 'error-toast',
                    duration: 2000,
                });
                console.error('Unexpected error:', error);
            }
        },
    });
    const onSubmit = (data: InviteLinkFormValues) => {
        handleSubmitInviteLinkMutation.mutate({ data });
    };

    const onInvalid = (err: unknown) => {
        console.error('Form validation errors:', err);
        if (err && typeof err === 'object') {
            const fieldNames = Object.keys(err as Record<string, unknown>);
            toast.error(`Validation failed on: ${fieldNames.join(', ')}`, {
                duration: 4000,
            });
        }
    };

    const extractYouTubeVideoId = (url: string): string | null => {
        const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[1] && match[1].length === 11 ? match[1] : null;
    };

    const handleFileUpload = async (
        file: File,
        field: 'coursePreview' | 'courseBanner' | 'courseMedia'
    ) => {
        try {
            const prev = form.getValues('uploadingStates');
            form.setValue('uploadingStates', { ...prev, [field]: true });

            const uploadedFileId = await uploadFile({
                file,
                setIsUploading: (state) =>
                    form.setValue('uploadingStates', { ...prev, [field]: state }),
                userId: 'your-user-id',
                source: INSTITUTE_ID,
                sourceId: 'COURSES',
            });

            const publicUrl = await getPublicUrl(uploadedFileId || '');

            if (uploadedFileId) {
                if (field === 'courseMedia') {
                    form.setValue(field, {
                        type: file.type.includes('video') ? 'video' : 'image',
                        id: uploadedFileId,
                    }); // set as string
                } else {
                    form.setValue(field, uploadedFileId); // set as string
                }
                if (field === 'coursePreview') {
                    form.setValue('coursePreviewBlob', publicUrl);
                } else if (field === 'courseBanner') {
                    form.setValue('courseBannerBlob', publicUrl);
                } else if (field === 'courseMedia') {
                    form.setValue('courseMediaBlob', publicUrl);
                }
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            const prev = form.getValues('uploadingStates');
            form.setValue('uploadingStates', { ...prev, [field]: false });
        }
    };

    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setValue('newTag', input);

        if (input.trim()) {
            const filtered = allTags
                ?.filter(
                    (tag: string) =>
                        tag.toLowerCase().includes(input.toLowerCase()) &&
                        !form.watch('tags').includes(tag) // Exclude already selected tags
                )
                .slice(0, 5);
            setValue('filteredTags', filtered);
        } else {
            setValue('filteredTags', []);
        }
    };

    const addTag = (e?: React.MouseEvent | React.KeyboardEvent, selectedTag?: string) => {
        if (e) e.preventDefault();
        const newTagValue = (form.watch('newTag') || '').trim();
        const tagToAdd = selectedTag || newTagValue;
        if (tagToAdd && !form.watch('tags').includes(tagToAdd)) {
            const updatedTags = [...form.watch('tags'), tagToAdd];
            setValue('tags', updatedTags);
        }
        setValue('newTag', '');
        setValue('filteredTags', []);
    };

    const removeTag = (tagToRemove: string) => {
        const updatedTags = form.watch('tags').filter((tag) => tag !== tagToRemove);
        setValue('tags', updatedTags);
    };

    const addDiscountForm = useDiscountForm<AddDiscountFormValues>({
        resolver: discountZodResolver(addDiscountSchema),
        defaultValues: {
            title: '',
            code: '',
            type: 'percent',
            value: 0,
            expires: '',
        },
    });

    const handleAddDiscount = (values: AddDiscountFormValues) => {
        const prevDiscounts = form.getValues('discounts');
        form.setValue('discounts', [
            ...prevDiscounts,
            {
                id: `d${prevDiscounts.length + 1}`,
                ...values,
            },
        ]);
        form.setValue('showAddDiscountDialog', false);
        addDiscountForm.reset();
    };

    const handleDeleteOpenField = (id: number) => {
        const updatedFields = customFieldsArray
            .filter((field, idx) => idx !== id)
            .map((field, index) => ({
                ...field,
                order: index, // Update order of remaining fields
            }));
        setValue('custom_fields', updatedFields);
    };

    // Function that explicitly updates the order property of all fields
    const updateFieldOrders = () => {
        const currentFields = getValues('custom_fields');

        if (!currentFields) return;

        // Create a copy with updated order values matching their array positions
        const updatedFields = currentFields.map((field, index) => ({
            ...field,
            order: index,
        }));

        // Update the form values
        setValue('custom_fields', updatedFields, {
            shouldDirty: true,
            shouldTouch: true,
        });
    };

    const toggleIsRequired = (id: number) => {
        const updatedFields = customFieldsArray?.map((field, idx) =>
            idx === id ? { ...field, isRequired: !field.isRequired } : field
        );
        setValue('custom_fields', updatedFields);
    };

    const handleAddGender = (type: string, name: string, oldKey: boolean) => {
        // Create the new field
        const newField = {
            id: String(customFields.length), // Use the current array length as the new ID
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && {
                options: [
                    {
                        id: '0',
                        value: 'MALE',
                        disabled: true,
                    },
                    {
                        id: '1',
                        value: 'FEMALE',
                        disabled: true,
                    },
                    {
                        id: '2',
                        value: 'OTHER',
                        disabled: true,
                    },
                ],
            }), // Include options if type is dropdown
            isRequired: true,
            key: '',
            order: customFields.length,
        };

        // Add the new field to the array
        const updatedFields = [...customFields, newField];

        // Update the form state
        setValue('custom_fields', updatedFields);
    };

    const handleAddOpenFieldValues = (type: string, name: string, oldKey: boolean) => {
        // Add the new field to the array
        const updatedFields = [
            ...customFields,
            {
                id: String(customFields.length), // Use the current array length as the new ID
                type,
                name,
                oldKey,
                isRequired: true,
                key: '',
                order: customFields.length,
            },
        ];

        // Update the form state with the new array
        setValue('custom_fields', updatedFields);
    };

    const handleValueChange = (id: string, newValue: string) => {
        const prevOptions = form.getValues('dropdownOptions');
        form.setValue(
            'dropdownOptions',
            prevOptions.map((option) =>
                option.id === id ? { ...option, value: newValue } : option
            )
        );
    };

    const handleEditClick = (id: number) => {
        const prevOptions = form.getValues('dropdownOptions');
        form.setValue(
            'dropdownOptions',
            prevOptions.map((option, idx) =>
                idx === id ? { ...option, disabled: !option.disabled } : option
            )
        );
    };

    const handleDeleteOptionField = (id: number) => {
        const prevOptions = form.getValues('dropdownOptions');
        form.setValue(
            'dropdownOptions',
            prevOptions.filter((field, idx) => idx !== id)
        );
    };

    const handleAddDropdownOptions = () => {
        const prevOptions = form.getValues('dropdownOptions');
        form.setValue('dropdownOptions', [
            ...prevOptions,
            {
                id: String(prevOptions.length),
                value: `option ${prevOptions.length + 1}`,
                disabled: true,
            },
        ]);
    };

    const handleCloseDialog = (type: string, name: string, oldKey: boolean) => {
        // Create the new field
        const newField = {
            id: String(customFields.length), // Use the current array length as the new ID
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && { options: form.getValues('dropdownOptions') }), // Include options if type is dropdown
            isRequired: true,
            key: '',
            order: customFields.length,
        };

        // Add the new field to the array
        const updatedFields = [...customFields, newField];

        // Update the form state
        setValue('custom_fields', updatedFields);

        // Reset dialog and temporary values
        form.setValue('isDialogOpen', false);
        form.setValue('textFieldValue', '');
        form.setValue('dropdownOptions', []);
    };
    // Hide menu when clicking outside
    useEffect(() => {
        if (!form.watch('showMediaMenu')) return;
        function handleClick(e: MouseEvent) {
            if (mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) {
                form.setValue('showMediaMenu', false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [form.watch('showMediaMenu')]);

    // Hide YouTube input when clicking outside
    useEffect(() => {
        if (!form.watch('showYoutubeInput')) return;
        function handleClick(e: MouseEvent) {
            if (youtubeInputRef.current && !youtubeInputRef.current.contains(e.target as Node)) {
                form.setValue('showYoutubeInput', false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [form.watch('showYoutubeInput')]);

    useEffect(() => {
        const loadCourseData = async () => {
            try {
                const parsedJsonData = await safeJsonParse(
                    inviteLinkDetails?.web_page_meta_data_json,
                    {}
                );
                const transformedData = courseDetailsData
                    ? await transformApiDataToCourseDataForInvite(
                          courseDetailsData as Parameters<
                              typeof transformApiDataToCourseDataForInvite
                          >[0]
                      )
                    : null;

                // Fall back when a candidate is null/undefined OR an empty
                // string / empty array / object whose values are all empty.
                // Saved invite-link templates often persist empty strings for
                // course-level fields, and `??` would treat those as "set"
                // and prevent us from falling back to the live course data.
                // Rich-text editors save "empty" as `<p></p>` / `<p><br></p>`,
                // so strip tags + whitespace before deciding emptiness.
                const hasValue = (v: unknown): boolean => {
                    if (v === null || v === undefined) return false;
                    if (typeof v === 'string') {
                        const stripped = v
                            .replace(/<[^>]*>/g, '')
                            .replace(/&nbsp;/g, '')
                            .trim();
                        return stripped !== '';
                    }
                    if (Array.isArray(v)) return v.length > 0;
                    if (typeof v === 'object') {
                        return Object.values(v as Record<string, unknown>).some(hasValue);
                    }
                    return true;
                };
                const pick = <T,>(...candidates: Array<T | null | undefined>): T | undefined =>
                    candidates.find(hasValue) as T | undefined;

                form.reset({
                    ...form.getValues(),
                    course: pick(parsedJsonData?.course, transformedData?.packageName) ?? '',
                    description:
                        pick(parsedJsonData?.description, transformedData?.description) ?? '',
                    learningOutcome:
                        pick(
                            parsedJsonData?.learningOutcome,
                            parsedJsonData?.whyLearn,
                            transformedData?.whyLearn
                        ) ?? '',
                    aboutCourse:
                        pick(
                            parsedJsonData?.aboutCourse,
                            parsedJsonData?.aboutTheCourse,
                            transformedData?.aboutTheCourse
                        ) ?? '',
                    targetAudience:
                        pick(
                            parsedJsonData?.targetAudience,
                            parsedJsonData?.whoShouldLearn,
                            transformedData?.whoShouldLearn
                        ) ?? '',
                    // Course-level media: prefer live course data over the
                    // saved template. The template's stored ids/URLs are
                    // often stale (presigned URLs expire daily, files can
                    // be replaced on the course). Only fall back to the
                    // template when the live course has no media at all.
                    coursePreview:
                        pick(
                            transformedData?.coursePreviewImageMediaId,
                            parsedJsonData?.coursePreview,
                            parsedJsonData?.coursePreviewImageMediaId
                        ) ?? '',
                    courseBanner:
                        pick(
                            transformedData?.courseBannerMediaId,
                            parsedJsonData?.courseBanner,
                            parsedJsonData?.courseBannerMediaId
                        ) ?? '',
                    courseMedia:
                        pick(
                            transformedData?.courseMediaId,
                            parsedJsonData?.courseMedia,
                            parsedJsonData?.courseMediaId
                        ) ?? { type: '', id: '' },
                    coursePreviewBlob:
                        pick(
                            transformedData?.coursePreviewImageMediaPreview,
                            parsedJsonData?.coursePreviewBlob,
                            parsedJsonData?.coursePreviewImageMediaPreview
                        ) ?? '',
                    courseBannerBlob:
                        pick(
                            transformedData?.courseBannerMediaPreview,
                            parsedJsonData?.courseBannerBlob,
                            parsedJsonData?.courseBannerMediaPreview
                        ) ?? '',
                    courseMediaBlob:
                        pick(
                            transformedData?.courseMediaPreview,
                            parsedJsonData?.courseMediaBlob,
                            parsedJsonData?.courseMediaPreview
                        ) ?? '',
                    tags: pick(parsedJsonData?.tags, transformedData?.tags) ?? [],
                });
            } catch (error) {
                console.error('Error transforming course data:', error);
            }
        };

        loadCourseData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseDetailsData, inviteLinkDetails]);

    useEffect(() => {
        if (singlePackageSessionId && inviteLinkDetails) {
            const paymentOptionDetailsForSelectedSession = getPaymentOptionBySessionId(
                inviteLinkDetails,
                getPackageSessionId({
                    courseId: parentBatch?.courseId || selectedCourse?.id || '',
                    levelId: parentBatch?.levelId || '',
                    sessionId: parentBatch?.sessionId || '',
                })
            );

            // Extract plan referral mappings from the payment option
            const planReferralMappings: Record<string, string> = {};
            const paymentOption = paymentOptionDetailsForSelectedSession?.payment_option;

            if (paymentOption) {
                if (paymentOption.type?.toLowerCase() === 'subscription') {
                    try {
                        const parsedMetadata = JSON.parse(
                            paymentOption.payment_option_metadata_json || '{}'
                        );
                        const customIntervals =
                            parsedMetadata?.subscriptionData?.customIntervals || [];
                        customIntervals.forEach(
                            (interval: { referral_option?: { id: string } }, index: number) => {
                                if (interval.referral_option?.id) {
                                    planReferralMappings[`${paymentOption.id}_option_${index}`] =
                                        interval.referral_option.id;
                                }
                            }
                        );
                    } catch (error) {
                        console.error('Failed to parse subscription metadata:', error);
                    }
                } else {
                    // For other plan types
                    const firstPlan = paymentOption.payment_plans?.[0];
                    if (firstPlan?.referral_option?.id) {
                        planReferralMappings[paymentOption.id] = firstPlan.referral_option.id;
                    }
                }
            }

            // Split payment plans by type
            const { freePlans: splitFreePlans, paidPlans: splitPaidPlans } = paymentsData
                ? splitPlansByType(paymentsData)
                : { freePlans: [], paidPlans: [] };

            const selectedPaymentPlan = getMatchingPaymentPlan(
                paymentsData,
                paymentOptionDetailsForSelectedSession?.payment_option?.id || ''
            );

            form.reset({
                ...form.getValues(),
                name: inviteLinkDetails?.name,
                includeInstituteLogo:
                    safeJsonParse(inviteLinkDetails?.web_page_meta_data_json, {})
                        ?.includeInstituteLogo || false,
                includePaymentPlans:
                    safeJsonParse(inviteLinkDetails?.web_page_meta_data_json, {})
                        ?.includePaymentPlans ?? true,
                custom_fields: isEditInviteLink
                    ? (inviteLinkDetails?.institute_custom_fields.length === 0
                        ? getInviteListCustomFields()
                        : ReTransformCustomFields(inviteLinkDetails))
                    : form.getValues('custom_fields'),
                freePlans: splitFreePlans,
                paidPlans: splitPaidPlans.map((plan) => ({
                    ...plan,
                    price: plan.price || '',
                })),
                selectedPlan: selectedPaymentPlan
                    ? {
                        ...selectedPaymentPlan,
                        price: selectedPaymentPlan.price || '',
                    }
                    : undefined,
                planReferralMappings: planReferralMappings,
                discounts: [],
                selectedDiscountId: 'none',
                selectedReferral: {},
                selectedReferralId: 'r1',
                restrictToSameBatch:
                    safeJsonParse(inviteLinkDetails?.web_page_meta_data_json, {})
                        ?.restrictToSameBatch || false,
                accessDurationType:
                    selectedPaymentPlan?.type?.toLowerCase() === 'subscription' ? 'define' : '',
                accessDurationDays: inviteLinkDetails?.learner_access_days?.toString() || '',
                inviteeEmails: [],
                customHtml:
                    safeJsonParse(inviteLinkDetails?.web_page_meta_data_json, {})?.customHtml || '',
                showRelatedCourses:
                    safeJsonParse(inviteLinkDetails?.web_page_meta_data_json, {})
                        ?.showRelatedCourses || false,
                postformfillConfiguration: safeJsonParse(inviteLinkDetails?.setting_json, {})?.postformfillConfiguration || {
                    redirectPath: '',
                    showLoginButton: true,
                    content: '',
                    collectBillingContactDetails: false,
                },
                subOrgSettings: (() => {
                    const subOrg = safeJsonParse(inviteLinkDetails?.setting_json, {})?.setting
                        ?.SUB_ORG_SETTING;
                    return {
                        enabled: !!subOrg,
                        authRoles: subOrg?.AUTH_ROLES ?? [],
                        allowedTeamRoles: subOrg?.ALLOWED_TEAM_ROLES ?? [],
                        adminPermissions: subOrg?.ADMIN_PERMISSIONS ?? ['FULL'],
                        memberCount: subOrg?.MEMBER_COUNT ?? null,
                    };
                })(),
                autopaySettings: (() => {
                    const autopay = safeJsonParse(inviteLinkDetails?.setting_json, {})?.setting
                        ?.AUTOPAY_SETTING;
                    return {
                        enabled: !!autopay?.ENABLED,
                        trialDays: autopay?.TRIAL_DAYS ?? 0,
                        maxAmount: autopay?.MAX_AMOUNT ?? null,
                    };
                })(),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        inviteLinkDetails,
        singlePackageSessionId,
        getPackageSessionId,
        parentBatch?.courseId,
        parentBatch?.levelId,
        parentBatch?.sessionId,
        selectedCourse?.id,
        paymentsData,
    ]);

    return (
        <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
            <DialogContent className="animate-fadeIn flex h-full w-full max-w-5xl flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="font-bold">
                            {isEditInviteLink ? `Update ${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Link` : `Create ${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Link`}
                        </DialogTitle>
                        {/* Preview Invite Link Dialog */}
                        <PreviewInviteLink
                            form={form}
                            levelName={parentBatch?.levelName || ''}
                            instituteLogo={instituteLogo}
                        />
                    </div>
                    {inviteLinkDetails?.invite_code && (
                        <div className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-2">
                            <span
                                className="truncate font-mono text-xs text-neutral-600"
                                title={createInviteLink(
                                    inviteLinkDetails.invite_code,
                                    instituteDetails?.learner_portal_base_url
                                )}
                            >
                                {createInviteLink(
                                    inviteLinkDetails.invite_code,
                                    instituteDetails?.learner_portal_base_url
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        createInviteLink(
                                            inviteLinkDetails.invite_code,
                                            instituteDetails?.learner_portal_base_url
                                        )
                                    );
                                    toast.success('Invite link copied to clipboard');
                                }}
                                className="shrink-0 rounded p-1 hover:bg-neutral-200"
                                title="Copy invite link"
                            >
                                <Copy className="size-4" />
                            </button>
                        </div>
                    )}
                    <div className="my-3 border-b" />
                </DialogHeader>
                <div className="flex-1 overflow-auto scroll-smooth">
                    <Form {...form}>
                        <form className="mt-6 space-y-6">
                            {/* Invite Name Card */}
                            <InviteNameCard form={form} />
                            {/* Institute Branding Card */}
                            <InstituteBrandingCard form={form} />
                            {/* Course Preview Card */}
                            <CoursePreviewCard
                                form={form}
                                handleTagInputChange={handleTagInputChange}
                                addTag={addTag}
                                removeTag={removeTag}
                                coursePreviewRef={coursePreviewRef}
                                courseBannerRef={courseBannerRef}
                                mediaMenuRef={mediaMenuRef}
                                youtubeInputRef={youtubeInputRef}
                                courseMediaRef={courseMediaRef}
                                handleFileUpload={handleFileUpload}
                                extractYouTubeVideoId={extractYouTubeVideoId}
                                isBundle={isBundle}
                                totalBatches={selectedBatches.length}
                            />
                            <PaymentPlanCard form={form} />

                            {/* Autopay + free-trial for paid subscription plans */}
                            <AutopaySettingsCard form={form} />

                            {/* Referral Program Card */}
                            <PlanReferralMappingCard form={form} />
                            {/* New Card for Restrict to Same Batch */}
                            <RestrictSameBatch form={form} />
                            {/* Customize Invite Form Card */}
                            <CustomInviteFormCard
                                form={form}
                                updateFieldOrders={updateFieldOrders}
                                handleDeleteOpenField={handleDeleteOpenField}
                                toggleIsRequired={toggleIsRequired}
                                handleAddGender={handleAddGender}
                                handleAddOpenFieldValues={handleAddOpenFieldValues}
                                handleValueChange={handleValueChange}
                                handleEditClick={handleEditClick}
                                handleDeleteOptionField={handleDeleteOptionField}
                                handleAddDropdownOptions={handleAddDropdownOptions}
                                handleCloseDialog={handleCloseDialog}
                            />
                            {/* Learner Access Duration Card */}
                            {form.watch('selectedPlan')?.type === 'subscription' && (
                                <LearnerAccessDurationCard form={form} />
                            )}

                            {/* Custom HTML Card */}
                            <CustomHTMLCard form={form} />

                            {/* Post Form Fill Configuration Card */}
                            <PostFormFillConfigurationCard form={form} />

                            {/* Sub-organization Settings Card */}
                            <SubOrgSettingsCard form={form} />
                        </form>
                    </Form>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="secondary"
                        className="p-5"
                        onClick={() => setShowSummaryDialog(false)}
                    >
                        Close
                    </MyButton>
                    <MyButton
                        type="button"
                        scale="small"
                        buttonType="primary"
                        className="p-5"
                        onClick={handleSubmit(onSubmit, onInvalid)}
                        disable={!form.watch('name') || handleSubmitInviteLinkMutation.isPending}
                    >
                        {handleSubmitInviteLinkMutation.isPending ? (
                            <div className="flex items-center gap-2">
                                <LoadingSpinner size={16} />
                                {isEditInviteLink ? 'Updating...' : 'Creating...'}
                            </div>
                        ) : isEditInviteLink ? (
                            `Update ${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Link`
                        ) : (
                            `Create ${getTerminology(OtherTerms.Invite, SystemTerms.Invite)} Link`
                        )}
                    </MyButton>
                </div>
            </DialogContent>

            {/* Payment Plans Dialog */}
            <PaymentPlansDialog form={form} />
            {/* Add New Payment Plan Dialog */}
            <AddPaymentPlanDialog form={form} />
            {/* Discount Settings Dialog */}
            <DiscountSettingsDialog form={form} />
            {/* Add New Discount Dialog */}
            <AddDiscountDialog
                form={form}
                addDiscountForm={addDiscountForm}
                handleAddDiscount={handleAddDiscount}
            />
            {/* Referral Program Selection Dialog */}
            <ReferralProgramDialog form={form} />
            {/* Add New Referral Program Dialog */}
            <AddReferralProgramDialog form={form} />
            {/* Plan Referral Configuration Dialog */}
            <PlanReferralConfigDialog form={form} />
        </Dialog>
    );
};

export default GenerateInviteLinkDialog;
