import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import { useAudienceCampaignForm } from '../../-hooks/useAudienceCampaignForm';
import { AudienceCampaignForm, defaultFormValues } from '../../-schema/AudienceCampaignSchema';
import { useCreateAudienceCampaign } from '../../-hooks/useCreateAudienceCampaign';
import { useUpdateAudienceCampaign } from '../../-hooks/useUpdateAudienceCampaign';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import CampaignCustomFieldsCard from './CampaignCustomFieldsCard';
import { useFileUpload } from '@/hooks/use-file-upload';
import { FileUploadComponent } from '@/components/design-system/file-upload';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { ImageSquare, PencilSimpleLine } from '@phosphor-icons/react';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { Info } from '@phosphor-icons/react';
import MultiEmailInput from '../audience-invite/components/MultiEmailInput';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import CampaignTypeDropdown from './CampaignTypeDropdown';
import StatusDropdown from './StatusDropdown';
import createCampaignLink from '../../-utils/createCampaignLink';
import CampaignLink from './CampaignLink';
import { CampaignItem } from '../../-services/get-campaigns-list';
import { getCampaignCustomFields } from '../../-utils/getCampaignCustomFields';
import { useGetCampaignById } from '../../-hooks/useGetCampaignById';

const parseEmailsFromCsv = (value?: string | null) => {
    if (!value) return [];
    return value
        .split(',')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
};

const generateKeyFromName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const mapApiFieldTypeToUi = (type?: string): 'text' | 'dropdown' | 'number' | 'textfield' => {
    const normalized = (type || '').toLowerCase();
    switch (normalized) {
        case 'dropdown':
        case 'select':
            return 'dropdown';
        case 'number':
            return 'number';
        case 'textfield':
        case 'textarea':
            return 'textfield';
        default:
            return 'text';
    }
};

const parseFieldsInput = (fields?: any[] | string | null) => {
    if (!fields) {
        return null;
    }

    if (Array.isArray(fields)) {
        return fields;
    }

    if (typeof fields === 'string') {
        try {
            const parsed = JSON.parse(fields);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            // console.warn('⚠️ [convertExistingCustomFields] Parsed custom fields is not an array');
        } catch (error) {
            console.error('❌ [convertExistingCustomFields] Failed to parse custom fields JSON:', error);
        }
    }

    return null;
};

const convertExistingCustomFields = (fields?: any[] | string | null) => {
    const normalizedFields = parseFieldsInput(fields);

    if (!normalizedFields || normalizedFields.length === 0) {
        console.log('📋 [convertExistingCustomFields] No custom fields to convert');
        return null;
    }

    console.log('📋 [convertExistingCustomFields] Converting', normalizedFields.length, 'fields from API');
    
    const converted = normalizedFields
        .map((field, index) => {
            const meta = field?.custom_field || {};
            const fieldName = meta.fieldName || field.field_name || `Field ${index + 1}`;
            const fieldKey = meta.fieldKey || generateKeyFromName(fieldName);
            const normalizedKey = fieldKey ? fieldKey.toLowerCase() : '';
            // const isPermanent = ['full_name', 'email', 'name'].includes(normalizedKey);
            const configOptions =
                typeof meta.config === 'string' && meta.config.length > 0
                    ? meta.config
                          .split(',')
                          .map((value: string) => value.trim())
                          .filter(Boolean)
                    : undefined;

            // Preserve status from API - default to ACTIVE if not present
            const fieldStatus = field.status || 'ACTIVE';

            const convertedField = {
                id: field.id || meta.id || field.field_id || `${index}`,
                _id: meta.id || field.id || field.field_id,
                field_id: field.field_id || meta.id || field.id,
                type: mapApiFieldTypeToUi(meta.fieldType || field.type),
                name: fieldName,
                oldKey: false,
                isRequired:
                    typeof meta.isMandatory === 'boolean' ? meta.isMandatory : field.isRequired ?? true,
                key: fieldKey,
                order:
                    typeof meta.formOrder === 'number'
                        ? Math.max(meta.formOrder - 1, 0)
                        : index,
                options: configOptions
                    ? configOptions.map((value: string, optIndex: number) => ({
                          id: `${field.id || meta.id || field.field_id || index}_opt_${optIndex}`,
                          value,
                          disabled: true,
                      }))
                    : undefined,
                // Preserve all original field data for payload
                status: fieldStatus,
                institute_id: field.institute_id,
                type_id: field.type_id,
                group_name: field.group_name || meta.groupName,
                individual_order: field.individual_order,
                group_internal_order: field.group_internal_order,
                // Store full custom_field object for payload
                custom_field_data: meta,
            };
            
            console.log('📋 [convertExistingCustomFields] Converted field:', fieldName, '(key:', fieldKey, ', status:', fieldStatus, ')');
            return convertedField;
        })
        .filter((field) => field.status !== 'DELETED') // Filter out deleted fields from display
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((field, index) => ({
            ...field,
            order: index,
        }));

    console.log('📋 [convertExistingCustomFields] Total converted fields:', converted.length);
    return converted;
};

const formatDateToDateInput = (value?: string | null, fallback?: string) => {
    if (!value) return fallback || '';
    const [datePart] = value.split('T');
    return datePart || value || fallback || '';
};

const formatDateTimeForPayload = (value?: string, isEndOfDay = false) => {
    if (!value) return '';
    if (value.includes('T')) return value;
    return `${value}${isEndOfDay ? 'T23:59:59' : 'T00:00:00'}`;
};

const getCampaignIdentifier = (campaign?: CampaignItem | null) =>
    campaign?.campaign_id || campaign?.id || campaign?.audience_id || '';

const buildInitialFormValues = (campaign?: CampaignItem | null): AudienceCampaignForm | undefined => {
    if (!campaign) return undefined;
    
    // Convert existing custom fields from campaign
    const existingCustomFields = convertExistingCustomFields(campaign.institute_custom_fields);
    
    // If no existing custom fields, load from settings (Name, Email, etc.)
    let customFieldsToUse: any[] = [];
    if (existingCustomFields && existingCustomFields.length > 0) {
        // Use existing fields from campaign
        customFieldsToUse = existingCustomFields;
    } else {
        // Load from settings (Name, Email, and other fields with Campaign visibility)
        const fieldsFromSettings = getCampaignCustomFields();
        // Transform to match form format (ensure oldKey is present)
        customFieldsToUse = fieldsFromSettings.map((field, index) => ({
            id: field.id || String(index),
            type: field.type,
            name: field.name,
            oldKey: (field as any).oldKey ?? false, // Ensure oldKey is present
            isRequired: field.isRequired ?? true,
            key: field.key,
            order: index,
            _id: field._id,
            options: field.options,
        }));
    }
    
    const initialValues = {
        ...defaultFormValues,
        campaign_name: campaign.campaign_name || '',
        campaign_type: campaign.campaign_type || '',
        description: campaign.description || '',
        campaign_objective: campaign.campaign_objective || '',
        to_notify: campaign.to_notify || '',
        send_respondent_email:
            typeof campaign.send_respondent_email === 'boolean'
                ? campaign.send_respondent_email
                : defaultFormValues.send_respondent_email,
        start_date_local:
            formatDateToDateInput(campaign.start_date_local, defaultFormValues.start_date_local) ||
            defaultFormValues.start_date_local,
        end_date_local:
            formatDateToDateInput(campaign.end_date_local, defaultFormValues.end_date_local) ||
            defaultFormValues.end_date_local,
        status: campaign.status?.toUpperCase?.() || defaultFormValues.status,
        json_web_metadata: campaign.json_web_metadata || '',
        // Include existing custom fields, or load from settings if none exist
        custom_fields: customFieldsToUse || [],
    };
    
    console.log('📋 [buildInitialFormValues] Building initial values for edit mode');
    console.log('📋 [buildInitialFormValues] Raw institute_custom_fields:', campaign.institute_custom_fields);
    console.log('📋 [buildInitialFormValues] Has existing fields:', existingCustomFields && existingCustomFields.length > 0);
    console.log('📋 [buildInitialFormValues] Custom fields to use:', initialValues.custom_fields.length, 'fields');
    console.log('📋 [buildInitialFormValues] Custom fields:', initialValues.custom_fields.map(f => ({ name: f.name, key: f.key })));
    
    return initialValues;
};

interface CreateCampaignFormProps {
    onSuccess?: () => void;
    campaign?: CampaignItem | null;
}

export const CreateCampaignForm: React.FC<CreateCampaignFormProps> = ({ onSuccess, campaign }) => {
    const { instituteDetails } = useInstituteDetailsStore();
    const isEditMode = Boolean(campaign);
    const editingCampaignId = useMemo(() => getCampaignIdentifier(campaign), [campaign]);
    
    // Fetch campaign data when in edit mode
    const { data: fetchedCampaign, isLoading: isLoadingCampaign } = useGetCampaignById({
        instituteId: instituteDetails?.id || '',
        audienceId: editingCampaignId || '',
        enabled: isEditMode && !!instituteDetails?.id && !!editingCampaignId,
    });

    // Use fetched campaign data if available, otherwise use passed campaign prop
    const campaignData = useMemo(() => {
        if (fetchedCampaign) {
            return fetchedCampaign as CampaignItem;
        }
        return campaign;
    }, [fetchedCampaign, campaign]);

    const initialFormValues = useMemo(() => buildInitialFormValues(campaignData as CampaignItem), [campaignData]);
    const [emails, setEmails] = useState<string[]>(() => parseEmailsFromCsv(campaignData?.to_notify as string || ''));
    const [latestCampaignShareLink, setLatestCampaignShareLink] = useState<string | null>(null);
    const { form, handleDateChange, handleSubmit, handleReset, isSubmitting } =
        useAudienceCampaignForm(initialFormValues);
    const {
        control,
        register,
        watch,
        setValue,
        getValues,
        formState: { errors },
    } = form;
    const createCampaign = useCreateAudienceCampaign();
    const updateCampaign = useUpdateAudienceCampaign();
    const existingCustomFields = useMemo(
        () => convertExistingCustomFields(campaignData?.institute_custom_fields),
        [campaignData?.institute_custom_fields]
    );
    const statusValue = watch('status');
    const isStatusActive = statusValue?.toUpperCase?.() === 'ACTIVE';
    
    // Store initial custom fields for create mode (from settings) so we can restore them on reset
    const initialCreateModeCustomFields = useRef<any[] | null>(null);

    useEffect(() => {
        if (campaignData) {
            setEmails(parseEmailsFromCsv(campaignData.to_notify));
        } else {
            setEmails([]);
        }
    }, [campaignData]);

    useEffect(() => {
        if (campaignData && editingCampaignId) {
            const shareLink = createCampaignLink(
                editingCampaignId,
                instituteDetails?.learner_portal_base_url
            );
            setLatestCampaignShareLink(shareLink);
        } else if (!campaignData) {
            setLatestCampaignShareLink(null);
        }
    }, [campaignData, editingCampaignId, instituteDetails?.learner_portal_base_url]);

    // Set start date to today (date only) when form initializes (create mode only)
    useEffect(() => {
        if (campaignData) return;
        const today = new Date();
        const todayDateOnly = today.toISOString().split('T')[0] || today.toISOString().substring(0, 10); // Format: YYYY-MM-DD
        if (todayDateOnly) {
            setValue('start_date_local', todayDateOnly, { shouldValidate: false });
        }
    }, [campaignData, setValue]);

    // File upload setup
    const { uploadFile, getPublicUrl } = useFileUpload();
    const campaignImageRef = useRef<HTMLInputElement>(null);
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities || {})[0];
    const userId =
        (tokenData as any)?.sub || (tokenData as any)?.userId || (tokenData as any)?.id || '';

    // Handle file upload for campaign image
    const handleCampaignImageUpload = async (file: File) => {
        try {
            const prev = getValues('uploadingStates');
            setValue('uploadingStates', { ...prev, campaign_image: true });

            const uploadedFileId = await uploadFile({
                file,
                setIsUploading: (state: boolean | ((prev: boolean) => boolean)) => {
                    const currentState = prev.campaign_image;
                    const newState = typeof state === 'function' ? state(currentState) : state;
                    setValue('uploadingStates', { ...prev, campaign_image: newState });
                },
                userId: 'your-user-id',
                source: INSTITUTE_ID,
                sourceId: 'CAMPAIGNS',
            });

            const publicUrl = await getPublicUrl(uploadedFileId || '');

            if (uploadedFileId) {
                setValue('campaign_image', uploadedFileId);
                setValue('campaign_imageBlob', publicUrl);
            }
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload campaign image');
        } finally {
            const prev = getValues('uploadingStates');
            setValue('uploadingStates', { ...prev, campaign_image: false });
        }
    };

    // Update form when campaign data is fetched
    useEffect(() => {
        if (isEditMode && isLoadingCampaign) {
            return; // Don't update form while loading
        }
        
        if (initialFormValues) {
            form.reset(initialFormValues);
            // In edit mode, ensure custom fields are set immediately from initial values
            if (isEditMode && initialFormValues.custom_fields && initialFormValues.custom_fields.length > 0) {
                console.log('📋 [Form Reset] Setting custom fields from initial values:', initialFormValues.custom_fields.length, 'fields');
                // Use a longer timeout to ensure form.reset() has fully completed
                setTimeout(() => {
                    setValue('custom_fields', initialFormValues.custom_fields, {
                        shouldDirty: false,
                        shouldTouch: false,
                    });
                }, 50);
            }
        } else {
            form.reset(defaultFormValues);
        }
    }, [form, initialFormValues, isEditMode, isLoadingCampaign, setValue]);

    // Custom fields array management
    const { fields: customFieldsArray, move: moveCustomField } = useFieldArray({
        control,
        name: 'custom_fields',
    });
    const customFields = getValues('custom_fields');

    /**
     * Get initial custom fields from settings (helper function)
     * Returns the normalized fields array without setting them in the form
     */
    const getInitialCustomFieldsFromSettings = useCallback(() => {
        // Get fields from settings cache (dynamically reads from localStorage)
        const fieldsFromSettings = getCampaignCustomFields();

        // Helper to check if a field is Name or Email
        const isNameOrEmail = (key?: string, name?: string): boolean => {
            const normalizedKey = (key || '').toLowerCase();
            const normalizedName = (name || '').toLowerCase();
            return (
                normalizedKey === 'full_name' ||
                normalizedKey === 'name' ||
                normalizedKey === 'email' ||
                normalizedName === 'full name' ||
                normalizedName === 'name' ||
                normalizedName === 'email'
            );
        };

        // Helper to check if a field is Phone Number
        const isPhoneNumber = (key?: string, name?: string): boolean => {
            const normalizedKey = (key || '').toLowerCase();
            const normalizedName = (name || '').toLowerCase();
            return (
                normalizedKey === 'phone_number' ||
                normalizedKey === 'phone' ||
                normalizedKey === 'phone_number' ||
                normalizedName === 'phone number' ||
                normalizedName === 'phone'
            );
        };

        // Separate fixed fields (Name, Email) from other fields
        const fixedFields: any[] = [];
        const otherFields: any[] = [];

        fieldsFromSettings.forEach((field) => {
            // Skip Phone Number - it's available via Add button
            if (isPhoneNumber(field.key, field.name)) {
                console.log('📋 [getInitialCustomFieldsFromSettings] Skipping Phone Number from settings (available via Add button)');
                return;
            }

            const transformedField = {
                id: field.id || String(fieldsFromSettings.indexOf(field)),
                type: field.type,
                name: field.name,
                oldKey: isNameOrEmail(field.key, field.name), // Mark Name/Email as fixed
                isRequired: field.isRequired ?? true,
                key: field.key,
                order: fieldsFromSettings.indexOf(field),
                _id: field._id, // Store actual field ID from settings for API payload
                options: field.options,
            };

            if (isNameOrEmail(field.key, field.name)) {
                fixedFields.push(transformedField);
            } else {
                otherFields.push(transformedField);
            }
        });

        // Ensure Name and Email are always present (even if not in settings)
        const hasName = fixedFields.some(
            (f) => f.key?.toLowerCase() === 'full_name' || f.key?.toLowerCase() === 'name' || f.name?.toLowerCase() === 'full name' || f.name?.toLowerCase() === 'name'
        );
        const hasEmail = fixedFields.some(
            (f) => f.key?.toLowerCase() === 'email' || f.name?.toLowerCase() === 'email'
        );

        if (!hasName) {
            fixedFields.unshift({
                id: 'full_name_fixed',
                type: 'text' as const,
                name: 'Full Name',
                oldKey: true, // Fixed field - cannot be deleted
                isRequired: true,
                key: 'full_name',
                order: 0,
            });
        }

        if (!hasEmail) {
            const emailIndex = fixedFields.length;
            fixedFields.push({
                id: 'email_fixed',
                type: 'text' as const,
                name: 'Email',
                oldKey: true, // Fixed field - cannot be deleted
                isRequired: true,
                key: 'email',
                order: emailIndex,
            });
        }

        // Combine: fixed fields first, then other fields from settings
        const allFields = [...fixedFields, ...otherFields];

        // Normalize order
        const normalizedFields = allFields.map((field, index) => ({
            ...field,
            order: index,
            id: field.id ?? String(index),
            isRequired: field.isRequired ?? true,
            oldKey: field.oldKey ?? false,
        }));

        return normalizedFields;
    }, []);

    /**
     * Load custom fields dynamically from settings cache
     * This function:
     * 1. Gets fields from settings via getCampaignCustomFields() (reads from localStorage cache)
     * 2. Ensures Name and Email are always present as fixed fields (cannot be deleted)
     * 3. Filters out Phone Number (since it's available via Add button)
     * 4. Transforms all fields from settings that have Campaign visibility enabled
     * 5. Converts to form-compatible format
     * 
     * When settings are updated, this will automatically reflect changes on next form load
     * Name and Email are always present as fixed fields, followed by other fields from settings
     */
    const applyDefaultCustomFields = useCallback(() => {
        const normalizedFields = getInitialCustomFieldsFromSettings();
        setValue('custom_fields', normalizedFields, {
            shouldDirty: false,
            shouldTouch: false,
        });
    }, [setValue, getInitialCustomFieldsFromSettings]);

    const setCustomFieldsFromExisting = useCallback(
        (fields: any[]) => {
            const normalizedFields = fields.map((field, index) => ({
                ...field,
                order: index,
                id: field.id ?? String(index),
                isRequired: field.isRequired ?? true,
                oldKey: field.oldKey ?? false,
            }));
            setValue('custom_fields', normalizedFields, {
                shouldDirty: false,
                shouldTouch: false,
            });
        },
        [setValue]
    );

    // Load custom fields immediately when form opens
    useEffect(() => {
        if (isEditMode) {
            // In edit mode, fields should already be in initialFormValues (from buildInitialFormValues)
            // Just ensure they're set if not already
            if (initialFormValues) {
                const currentFields = getValues('custom_fields');
                
                if (initialFormValues.custom_fields && initialFormValues.custom_fields.length > 0) {
                    if (!currentFields || currentFields.length === 0) {
                        console.log('📋 [CreateCampaignForm] Setting custom fields from initialFormValues:', initialFormValues.custom_fields.length, 'fields');
                        setTimeout(() => {
                            setValue('custom_fields', initialFormValues.custom_fields, {
                                shouldDirty: false,
                                shouldTouch: false,
                            });
                        }, 100);
                    }
                }
            }
            return undefined;
        } else {
            // In create mode, load fields immediately from settings
            // This ensures Name, Email, and all custom fields appear automatically when form opens
            console.log('📋 [CreateCampaignForm] Create mode - loading fields from settings immediately');
            // Use setTimeout to ensure form is fully initialized
            const timer = setTimeout(() => {
                const normalizedFields = getInitialCustomFieldsFromSettings();
                // Store the initial custom fields for reset functionality
                initialCreateModeCustomFields.current = normalizedFields;
                // Apply the fields to the form
                setValue('custom_fields', normalizedFields, {
                    shouldDirty: false,
                    shouldTouch: false,
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [
        getInitialCustomFieldsFromSettings,
        isEditMode,
        initialFormValues,
        getValues,
        setValue,
    ]);

    const handleFormReset = () => {
        if (isEditMode && existingCustomFields && existingCustomFields.length > 0) {
            // In edit mode, reset to original campaign data
            handleReset();
            setCustomFieldsFromExisting(existingCustomFields);
            setEmails(parseEmailsFromCsv(campaignData?.to_notify));
        } else {
            // In create mode, reset form values but preserve initial custom fields
            // Get the initial custom fields that were loaded when form opened
            const fieldsToRestore = initialCreateModeCustomFields.current;
            
            // Reset form to default values
            handleReset();
            
            // Immediately restore initial custom fields after reset
            setTimeout(() => {
                if (fieldsToRestore && fieldsToRestore.length > 0) {
                    // Restore to the initial fields from when form was opened
                    setValue('custom_fields', fieldsToRestore, {
                        shouldDirty: false,
                        shouldTouch: false,
                    });
                } else {
                    // If no initial fields stored yet, load from settings
                    const normalizedFields = getInitialCustomFieldsFromSettings();
                    initialCreateModeCustomFields.current = normalizedFields;
                    setValue('custom_fields', normalizedFields, {
                        shouldDirty: false,
                        shouldTouch: false,
                    });
                }
                setEmails([]);
            }, 50);
        }
    };

    // Custom field handlers
    const updateFieldOrders = () => {
        const currentFields = getValues('custom_fields');
        if (!currentFields) return;
        const updatedFields = currentFields.map((field, index) => ({
            ...field,
            order: index,
        }));
        setValue('custom_fields', updatedFields, {
            shouldDirty: true,
            shouldTouch: true,
        });
    };

    const handleDeleteOpenField = (id: number) => {
        // Instead of removing the field, set its status to DELETED
        const updatedFields = customFieldsArray.map((field, idx) => {
            if (idx === id) {
                return {
                    ...field,
                    status: 'DELETED',
                };
            }
            return field;
        });
        setValue('custom_fields', updatedFields);
    };

    const toggleIsRequired = (id: number) => {
        const updatedFields = customFieldsArray?.map((field, idx) =>
            idx === id ? { ...field, isRequired: !field.isRequired } : field
        );
        setValue('custom_fields', updatedFields);
    };

    const handleAddGender = (type: string, name: string, oldKey: boolean) => {
        const newField = {
            id: String(customFields.length),
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && {
                options: [
                    { id: '0', value: 'MALE', disabled: true },
                    { id: '1', value: 'FEMALE', disabled: true },
                    { id: '2', value: 'OTHER', disabled: true },
                ],
            }),
            isRequired: true,
            key: '',
            order: customFields.length,
        };
        const updatedFields = [...customFields, newField];
        setValue('custom_fields', updatedFields);
    };

    const handleAddOpenFieldValues = (type: string, name: string, oldKey: boolean) => {
        const updatedFields = [
            ...customFields,
            {
                id: String(customFields.length),
                type,
                name,
                oldKey,
                isRequired: true,
                key: '',
                order: customFields.length,
            },
        ];
        setValue('custom_fields', updatedFields);
    };

    // Handler for adding Phone Number (similar to handleAddGender)
    const handleAddPhoneNumber = (type: string, name: string, oldKey: boolean) => {
        const newField = {
            id: String(customFields.length),
            type,
            name,
            oldKey,
            isRequired: true,
            key: 'phone_number',
            order: customFields.length,
        };
        const updatedFields = [...customFields, newField];
        setValue('custom_fields', updatedFields);
    };

    const handleValueChange = (id: string, newValue: string) => {
        const prevOptions = getValues('dropdownOptions');
        setValue(
            'dropdownOptions',
            prevOptions.map((option) =>
                option.id === id ? { ...option, value: newValue } : option
            )
        );
    };

    const handleEditClick = (id: number) => {
        const prevOptions = getValues('dropdownOptions');
        setValue(
            'dropdownOptions',
            prevOptions.map((option, idx) =>
                idx === id ? { ...option, disabled: !option.disabled } : option
            )
        );
    };

    const handleDeleteOptionField = (id: number) => {
        const prevOptions = getValues('dropdownOptions');
        setValue(
            'dropdownOptions',
            prevOptions.filter((field, idx) => idx !== id)
        );
    };

    const handleAddDropdownOptions = () => {
        const prevOptions = getValues('dropdownOptions');
        setValue('dropdownOptions', [
            ...prevOptions,
            {
                id: String(prevOptions.length),
                value: `option ${prevOptions.length + 1}`,
                disabled: true,
            },
        ]);
    };

    const handleCloseDialog = (type: string, name: string, oldKey: boolean) => {
        const newField = {
            id: String(customFields.length),
            type,
            name,
            oldKey,
            ...(type === 'dropdown' && { options: getValues('dropdownOptions') }),
            isRequired: true,
            key: '',
            order: customFields.length,
        };
        const updatedFields = [...customFields, newField];
        setValue('custom_fields', updatedFields);
        setValue('isDialogOpen', false);
        setValue('textFieldValue', '');
        setValue('dropdownOptions', []);
    };


    const mapFieldTypeToPayload = (type?: string) => {
        if (!type) return 'TEXT';
        const normalized = type.toLowerCase();
        switch (normalized) {
            case 'text':
            case 'textfield':
            case 'textarea':
                return 'TEXT';
            case 'number':
                return 'NUMBER';
            case 'email':
                return 'EMAIL';
            case 'date':
                return 'DATE';
            case 'dropdown':
            case 'select':
                return 'DROPDOWN';
            default:
                return normalized.toUpperCase();
        }
    };

    const convertFieldsToPayload = (fields: any[], instituteId: string) => {
        if (!Array.isArray(fields) || fields.length === 0) return [];

        return fields.map((field, index) => {
            const options =
                Array.isArray(field.options) && field.options.length > 0
                    ? field.options.map((option: any) => option.value?.trim()).filter(Boolean)
                    : undefined;

            // Use existing field data if available (from API), otherwise create new structure
            const fieldId = field.id || field._id || field.field_id;
            const customFieldData = field.custom_field_data || field.custom_field || {};
            
            // Build the payload according to the required structure
            const payload: any = {
                ...(fieldId && { id: fieldId }),
                field_id: field.field_id || customFieldData.id || fieldId,
                institute_id: field.institute_id || instituteId,
                type: field.type_id || customFieldData.fieldType || mapFieldTypeToPayload(field.type),
                type_id: field.type_id || customFieldData.fieldType || mapFieldTypeToPayload(field.type),
                group_name: field.group_name || customFieldData.groupName || '',
                status: field.status || 'ACTIVE', // Preserve status (ACTIVE or DELETED)
                individual_order: field.individual_order ?? field.order ?? index,
                group_internal_order: field.group_internal_order ?? 0,
                custom_field: {
                    ...(customFieldData.id && { id: customFieldData.id }),
                    ...(customFieldData.guestId && { guestId: customFieldData.guestId }),
                    fieldKey: field.key || customFieldData.fieldKey || generateKeyFromName(field.name),
                    fieldName: field.name || customFieldData.fieldName || `Field ${index + 1}`,
                    fieldType: mapFieldTypeToPayload(field.type || customFieldData.fieldType),
                    defaultValue: customFieldData.defaultValue || '',
                    config: options ? options.join(',') : (customFieldData.config || ''),
                    formOrder: typeof field.order === 'number' ? field.order + 1 : (customFieldData.formOrder || index + 1),
                    isMandatory: Boolean(
                        typeof field.isRequired === 'boolean'
                            ? field.isRequired
                            : customFieldData.isMandatory ?? true
                    ),
                    isFilter: customFieldData.isFilter ?? false,
                    isSortable: customFieldData.isSortable ?? false,
                    isHidden: customFieldData.isHidden ?? false,
                    ...(customFieldData.createdAt && { createdAt: customFieldData.createdAt }),
                    ...(customFieldData.updatedAt && { updatedAt: customFieldData.updatedAt }),
                    ...(customFieldData.sessionId && { sessionId: customFieldData.sessionId }),
                    ...(customFieldData.liveSessionId && { liveSessionId: customFieldData.liveSessionId }),
                    customFieldValue: customFieldData.customFieldValue || '',
                    groupName: field.group_name || customFieldData.groupName || '',
                    groupInternalOrder: field.group_internal_order ?? 0,
                    individualOrder: field.individual_order ?? field.order ?? index,
                },
            };

            return payload;
        });
    };

    const onFormSubmit = handleSubmit(async (data: AudienceCampaignForm) => {
        if (!instituteDetails?.id) {
            toast.error('Institute context unavailable. Please refresh and try again.');
            return;
        }

        let parsedCustomFields: unknown = undefined;
        if (data.institute_custom_fields) {
            try {
                const parsed = JSON.parse(data.institute_custom_fields);
                if (parsed !== null && !Array.isArray(parsed)) {
                    toast.error('Custom fields JSON must be an array.');
                    return;
                }
                parsedCustomFields = parsed;
            } catch (error) {
                toast.error('Custom fields must be valid JSON.');
                console.error('Invalid custom fields JSON:', error);
                return;
            }
        }

        const hasCustomFieldShape = Array.isArray(parsedCustomFields)
            ? (parsedCustomFields as any[]).every((field) => field && field.custom_field)
            : false;

        const transformedCustomFields = convertFieldsToPayload(
            data.custom_fields || [],
            instituteDetails.id
        );

        const customFieldsFromJson =
            Array.isArray(parsedCustomFields) && parsedCustomFields.length > 0
                ? hasCustomFieldShape
                    ? (parsedCustomFields as any[])
                    : convertFieldsToPayload(parsedCustomFields as any[], instituteDetails.id)
                : [];

        const customFieldsToSend =
            customFieldsFromJson.length > 0 ? customFieldsFromJson : transformedCustomFields;

        // Include all fields (both ACTIVE and DELETED) in the payload
        // The API will handle the status updates
        const allFieldsIncludingDeleted = (data.custom_fields || []).map((field: any) => field);
        const allCustomFieldsPayload = convertFieldsToPayload(allFieldsIncludingDeleted, instituteDetails.id);

        // Debug logging
        console.log('Custom Fields Debug:', {
            'data.custom_fields': data.custom_fields,
            transformedCustomFields,
            parsedCustomFields,
            customFieldsToSend,
            allCustomFieldsPayload,
        });

        const payload = {
            id: editingCampaignId || undefined,
            institute_id: instituteDetails.id,
            campaign_name: data.campaign_name.trim(),
            campaign_type: data.campaign_type.trim(),
            description: data.description?.trim() || '',
            campaign_objective: data.campaign_objective?.trim() || '',
            to_notify: emails.join(', '),
            send_respondent_email: Boolean(data.send_respondent_email),
            json_web_metadata: data.json_web_metadata?.trim() || '',
            created_by_user_id: userId,
            start_date_local: formatDateTimeForPayload(data.start_date_local, false),
            end_date_local: formatDateTimeForPayload(data.end_date_local, true),
            status: data.status?.toUpperCase?.() || data.status,
            institute_custom_fields: allCustomFieldsPayload.length > 0 ? allCustomFieldsPayload : customFieldsToSend,
        };

        try {
            if (isEditMode && editingCampaignId) {
                await updateCampaign.mutateAsync({
                    audienceId: editingCampaignId,
                    payload,
                });
                const shareLink = createCampaignLink(
                    editingCampaignId,
                    instituteDetails?.learner_portal_base_url
                );
                setLatestCampaignShareLink(shareLink);
                onSuccess?.();
            } else {
                const createdCampaign = await createCampaign.mutateAsync(payload);
                const createdCampaignId = createdCampaign?.id || createdCampaign?.campaign_id;
                if (createdCampaignId) {
                    const shareLink = createCampaignLink(
                        createdCampaignId,
                        instituteDetails?.learner_portal_base_url
                    );
                    setLatestCampaignShareLink(shareLink);
                }
                handleFormReset();
                onSuccess?.();
            }
        } catch (error) {
            console.error('Error saving campaign:', error);
            if (!isEditMode) {
                setLatestCampaignShareLink(null);
            }
        }
    });

    useEffect(() => {
        setValue('to_notify', emails.join(', '));
    }, [emails, setValue]);

    const isSaving = isSubmitting || createCampaign.isPending || updateCampaign.isPending;
    const primaryButtonLabel = isEditMode
        ? isSaving
            ? 'Saving...'
            : 'Save Changes'
        : isSaving
          ? 'Creating...'
          : 'Create Campaign';

    // Show loading state while fetching campaign data
    if (isEditMode && isLoadingCampaign) {
        return (
            <div className="flex items-center justify-center py-8">
                <DashboardLoader />
            </div>
        );
    }

    return (
        <form onSubmit={onFormSubmit} className="w-full space-y-6">
            {isStatusActive && latestCampaignShareLink && (
                <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
                    <p className="text-sm font-semibold text-primary-700">
                        Campaign link ready to share
                    </p>
                    <CampaignLink
                        presetLink={latestCampaignShareLink}
                        className="mt-2"
                        label={undefined}
                    />
                </div>
            )}
            {/* Campaign Name */}
            <div>
                <label className="block text-sm font-semibold text-neutral-700">
                    Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    placeholder="Enter campaign name"
                    {...register('campaign_name')}
                    className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                {errors.campaign_name && (
                    <span className="mt-1 block text-sm text-red-500">
                        {errors.campaign_name.message as string}
                    </span>
                )}
            </div>

            {/* Campaign Image */}

            {/* Campaign Type & Objective Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-sm font-semibold text-neutral-700">
                        Campaign Type <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-2">
                        <CampaignTypeDropdown
                            value={watch('campaign_type')}
                            error={errors.campaign_type?.message as string}
                            onChange={(val) => {
                                setValue('campaign_type', val, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                });
                            }}
                        />
                    </div>
                </div>
                {/* CampaignObjective */}
                <div>
                    <label className="block text-sm font-semibold text-neutral-700">
                        Campaign Objective 
                        {/* <span className="text-red-500">*</span> */}
                    </label>
                    <input
                        type="text"
                        placeholder="e.g., Engagement, Retention"
                        {...register('campaign_objective')}
                        className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    {/* {errors.campaign_objective && (
                        <span className="mt-1 block text-sm text-red-500">
                            {errors.campaign_objective.message as string}
                        </span>
                    )} */}
                </div>
            </div>

            {/* Emails & Share Analytics */}
            <div  className="  w-full  gap-2 rounded-lg border border-neutral-300 px-3 py-2">
                <div className="flex flex-wrap gap-2">
                <label className="block text-sm font-semibold text-neutral-700"> Team Notifications </label>
                <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
                                    aria-label="Information about sharing campaign analytics"
                                >
                                    <Info className="size-4" weight="bold" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-neutral-800 text-white text-xs">
                                <p>Enter email addresses of team members who should receive campaign updates</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <MultiEmailInput
                    value={emails}
                    onChange={setEmails}
                    placeholder="Enter email addresses"
                    error={errors?.to_notify?.message}
                    
                />
            

            {/* Share Campaign Analytics */}
            <div className="flex items-center justify-between gap-2 px-2 py-2">
                <div className="flex items-center gap-2">
                    <label className="block text-sm font-semibold text-neutral-700">
                        Share Campaign Analytics with Team Members
                    </label>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
                                    aria-label="Information about sharing campaign analytics"
                                >
                                    <Info className="size-4" weight="regular" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-neutral-800 text-white text-xs">
                                <p>Allow team members to view campaign performance metrics and reports</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Switch
                    checked={watch('send_respondent_email')}
                    onCheckedChange={(checked: boolean) =>
                        setValue('send_respondent_email', checked)
                    }
                />
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-semibold text-neutral-700">Campaign Description</label>
                <textarea
                    placeholder="Describe the campaign's goals, target audience, and key messages"
                    rows={3}
                    {...register('description')}
                    className="mt-2 w-full resize-none rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                {errors.description && (
                    <span className="mt-1 block text-sm text-red-500">
                        {errors.description.message as string}
                    </span>
                )}
            </div>

            {/* Start & End Date Row */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Start Date */}
                <div>
                    <label className="block text-sm font-semibold text-neutral-700">
                        Start Date <span className="text-red-500">*</span>
                    </label>
                    <Controller
                        name="start_date_local"
                        control={control}
                        render={({ field }) => {
                            const rawValue = field.value as unknown;
                            let dateValue = '';

                            // Handle different input types (string date, Date object, or ISO string)
                            if (typeof rawValue === 'string' && rawValue !== '') {
                                // If it's already in YYYY-MM-DD format, use it directly
                                if (rawValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    dateValue = rawValue;
                                } else {
                                    // If it's an ISO string, extract just the date part
                                    const date = new Date(rawValue);
                                    if (!Number.isNaN(date.getTime())) {
                                        dateValue = date.toISOString().split('T')[0] || date.toISOString().substring(0, 10);
                                    }
                                }
                            } else if (
                                rawValue &&
                                typeof rawValue === 'object' &&
                                typeof (rawValue as Date).toISOString === 'function'
                            ) {
                                const isoString = (rawValue as Date).toISOString();
                                dateValue = isoString.split('T')[0] || isoString.substring(0, 10);
                            }

                            // Set minimum date to today (date only)
                            const today = new Date();
                            const minDate = today.toISOString().split('T')[0] || today.toISOString().substring(0, 10); // Format: YYYY-MM-DD

                            return (
                                <input
                                    type="date"
                                    value={dateValue}
                                    min={minDate}
                                    onChange={(e) => {
                                        const selectedDate = e.target.value; // Already in YYYY-MM-DD format
                                        setValue('start_date_local', selectedDate, {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        });
                                    }}
                                    className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                />
                            );
                        }}
                    />
                    {errors.start_date_local && (
                        <span className="mt-1 block text-sm text-red-500">
                            {errors.start_date_local.message as string}
                        </span>
                    )}
                </div>

                {/* End Date */}
                <div>
                    <label className="block text-sm font-semibold text-neutral-700">
                        End Date <span className="text-red-500">*</span>
                    </label>
                    <Controller
                        name="end_date_local"
                        control={control}
                        render={({ field }) => {
                            const rawValue = field.value as unknown;
                            let dateValue = '';

                            // Handle different input types (string date, Date object, or ISO string)
                            if (typeof rawValue === 'string' && rawValue !== '') {
                                // If it's already in YYYY-MM-DD format, use it directly
                                if (rawValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    dateValue = rawValue;
                                } else {
                                    // If it's an ISO string, extract just the date part
                                    const date = new Date(rawValue);
                                    if (!Number.isNaN(date.getTime())) {
                                        dateValue = date.toISOString().split('T')[0] || date.toISOString().substring(0, 10);
                                    }
                                }
                            } else if (
                                rawValue &&
                                typeof rawValue === 'object' &&
                                typeof (rawValue as Date).toISOString === 'function'
                            ) {
                                const isoString = (rawValue as Date).toISOString();
                                dateValue = isoString.split('T')[0] || isoString.substring(0, 10);
                            }

                            // Compute minimum End Date = Start Date + 1 day (date only)
                            const startDateValue = watch('start_date_local');
                            let minEndDate: string;

                            if (startDateValue) {
                                const start = new Date(startDateValue);
                                const nextDay = new Date(start);
                                nextDay.setDate(start.getDate() + 1); // Move to the next day
                                const nextDayIso = nextDay.toISOString();
                                minEndDate = (nextDayIso.split('T')[0] || nextDayIso.substring(0, 10)) as string; // Format: YYYY-MM-DD
                            } else {
                                // Fallback: today + 1 day
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const tomorrowIso = tomorrow.toISOString();
                                minEndDate = (tomorrowIso.split('T')[0] || tomorrowIso.substring(0, 10)) as string; // Format: YYYY-MM-DD
                            }

                            return (
                                <input
                                    type="date"
                                    value={dateValue}
                                    min={minEndDate}
                                    onChange={(e) => {
                                        const selectedDate = e.target.value; // Already in YYYY-MM-DD format
                                        setValue('end_date_local', selectedDate, {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        });
                                    }}
                                    className="mt-2 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                />
                            );
                        }}
                    />
                    {errors.end_date_local && (
                        <span className="mt-1 block text-sm text-red-500">
                            {errors.end_date_local.message as string}
                        </span>
                    )}
                </div>
            </div>

            {/* Status */}
            <div>
                <div className="flex items-center gap-2">
                <label className="block text-sm font-semibold text-neutral-700">Status</label>
                <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
                                    aria-label="Information about sharing campaign analytics"
                                >
                                    <Info className="size-4" weight="bold" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs bg-neutral-800 text-white text-xs">
                                <p>To share the campaign link with Learners, please ensure the campaign status is set to Active.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="mt-2">
                    <StatusDropdown
                        value={watch('status')}
                        error={errors.status?.message as string}
                        onChange={(val) => {
                            setValue('status', val, {
                                shouldValidate: true,
                                shouldDirty: true,
                            });
                        }}
                    />
                </div>
            </div>

            {/* JSON Metadata */}

            {/* Customize Campaign Form - Custom Fields Card */}
            <CampaignCustomFieldsCard
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
                handleAddPhoneNumber={handleAddPhoneNumber}
            />

            {/* Custom HTML Card */}
            {/* <CustomHTMLCard form={form} /> */}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-6">
                <MyButton type="button" onClick={handleFormReset} buttonType="secondary" scale="medium">
                    Reset
                </MyButton>
                <MyButton
                    type="submit"
                    disabled={isSaving}
                    buttonType="primary"
                    scale="medium"
                >
                    {primaryButtonLabel}
                </MyButton>
            </div>
        </form>
    );
};
