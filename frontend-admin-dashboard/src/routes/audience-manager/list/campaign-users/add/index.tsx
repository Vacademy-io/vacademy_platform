import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PaperPlaneTilt, Spinner, UsersThree } from '@phosphor-icons/react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { submitAudienceLeadAsAdmin, SubmitLeadRequest } from '../../-services/submit-audience-lead';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { OtherTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { CustomFieldRenderer } from '@/components/common/custom-fields/CustomFieldRenderer';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';

const NAMESPACE = 'audienceManagerCampaignUsersAdd';

/**
 * Fallback translate function for the zod search-param schema, which is
 * built at module scope (outside any React render tree) so it cannot use
 * the `useTranslation` hook. Uses the shared i18next singleton directly.
 */
const globalT: TFunction = ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: NAMESPACE, ...options })) as TFunction;

function buildAddResponseSearchSchema(t: TFunction) {
    return z.object({
        campaignId: z.string().min(1, t('schema.campaignIdRequired')),
        campaignName: z.string().optional(),
        customFields: z.string().optional(), // JSON string of custom fields
    });
}

const addResponseSearchSchema = buildAddResponseSearchSchema(globalT);

export const Route = createFileRoute('/audience-manager/list/campaign-users/add/')({
    component: AddResponsePage,
    validateSearch: addResponseSearchSchema,
});

interface CustomFieldConfig {
    id: string;
    fieldName: string;
    fieldKey: string;
    fieldType: string;
    isMandatory: boolean;
    defaultValue?: string;
    formOrder: number;
    config?: string;
    options?: string[];
    fileConfig?: {
        allowedFileTypes?: string[];
        maxSizeMB?: number;
    };
}

export function AddResponsePage() {
    const { t } = useTranslation(NAMESPACE);
    const { t: tSubmitLead } = useTranslation('audienceManagerSubmitAudienceLead');
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: Route.id });
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const { instituteDetails } = useInstituteDetailsStore();
    const instituteId = instituteDetails?.id;

    useEffect(() => {
        setNavHeading(t('navHeading'));
    }, [setNavHeading, t]);

    // Fetch custom fields from backend if not in URL params
    const { data: fetchedFields } = useQuery({
        queryKey: ['campaign-custom-fields', search.campaignId, instituteId],
        queryFn: async () => {
            if (!instituteId || !search.campaignId) return [];
            const response = await authenticatedAxiosInstance.get(
                `${BASE_URL}/admin-core-service/common/custom-fields/feature-fields`,
                { params: { instituteId, type: 'AUDIENCE_FORM', typeId: search.campaignId } }
            );
            return Array.isArray(response?.data) ? response.data : [];
        },
        enabled: !search.customFields && !!instituteId && !!search.campaignId,
        staleTime: 60000,
    });

    const parseFields = (raw: any[]): CustomFieldConfig[] => {
        return raw
            .map((field: any, index: number) => {
                const customField = field.custom_field || field;
                const configStr = customField.config || field.config || '';

                let options: string[] | undefined;
                let fileConfig: { allowedFileTypes?: string[]; maxSizeMB?: number } | undefined;
                let defaultFromConfig: string | undefined;

                if (configStr) {
                    try {
                        const parsed = JSON.parse(configStr);
                        if (Array.isArray(parsed)) {
                            options = parsed.map((opt: any) =>
                                typeof opt === 'string' ? opt : opt.value || opt.label || ''
                            );
                        } else if (typeof parsed === 'object' && parsed !== null) {
                            // Object-format config: { options, defaultValue, allowedFileTypes, ... }
                            if (Array.isArray(parsed.options)) {
                                options = parsed.options.map((opt: any) =>
                                    typeof opt === 'string' ? opt : opt.value || opt.label || ''
                                );
                            }
                            if (Array.isArray(parsed.allowedFileTypes) || parsed.maxSizeMB) {
                                fileConfig = {
                                    allowedFileTypes: parsed.allowedFileTypes,
                                    maxSizeMB: parsed.maxSizeMB,
                                };
                            }
                            if (parsed.defaultValue !== undefined) {
                                defaultFromConfig = String(parsed.defaultValue);
                            }
                            // Legacy: comma-separated options wrapped in object
                            if (
                                !options &&
                                (parsed.coommaSepartedOptions || parsed.commaSeparatedOptions)
                            ) {
                                const csv =
                                    parsed.coommaSepartedOptions || parsed.commaSeparatedOptions;
                                options = csv
                                    .split(',')
                                    .map((v: string) => v.trim())
                                    .filter(Boolean);
                            }
                        }
                    } catch {
                        // Not JSON — treat as plain comma-separated string (legacy format)
                        if (configStr.includes(',')) {
                            options = configStr
                                .split(',')
                                .map((v: string) => v.trim())
                                .filter(Boolean);
                        }
                    }
                }

                return {
                    id: customField.id || field.id,
                    fieldName:
                        customField.fieldName || customField.field_name || field.field_name || '',
                    fieldKey:
                        customField.fieldKey || customField.field_key || field.field_key || '',
                    fieldType:
                        customField.fieldType ||
                        customField.field_type ||
                        field.field_type ||
                        'TEXT',
                    isMandatory: customField.isMandatory ?? field.isMandatory ?? true,
                    defaultValue:
                        customField.defaultValue || field.defaultValue || defaultFromConfig || '',
                    // The per-form mapping order is what the admin arranged and what the
                    // public form renders; the master formOrder is the shared catalog
                    // position every other form inherits. Sorting by the master made this
                    // page show the fields in a different sequence to the respondent's.
                    // `??` not `||`: a seeded field's master order is NULL, and `|| 0`
                    // floated all of those to the top.
                    formOrder:
                        field.individual_order ??
                        customField.individualOrder ??
                        customField.formOrder ??
                        field.formOrder ??
                        index,
                    config: configStr,
                    options,
                    fileConfig,
                };
            })
            .filter((f: CustomFieldConfig) => f.id && f.fieldName)
            .sort((a, b) => (a.formOrder ?? 0) - (b.formOrder ?? 0));
    };

    // Parse custom fields from URL params OR from API fetch
    const customFields = useMemo<CustomFieldConfig[]>(() => {
        if (search.customFields) {
            try {
                const parsed = JSON.parse(search.customFields);
                if (Array.isArray(parsed)) return parseFields(parsed);
            } catch (error) {
                console.error('Error parsing custom fields:', error);
            }
        }
        if (fetchedFields && fetchedFields.length > 0) {
            return parseFields(fetchedFields);
        }
        return [];
    }, [search.customFields, fetchedFields]);

    // Initialize form values with default values
    useEffect(() => {
        const initialValues: Record<string, string> = {};
        customFields.forEach((field) => {
            initialValues[field.id] = field.defaultValue || '';
        });
        setFormValues(initialValues);
    }, [customFields]);

    const handleInputChange = (fieldId: string, value: string) => {
        setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    const handleBack = () => {
        navigate({
            to: '/audience-manager/list/campaign-users' as any,
            search: {
                campaignId: search.campaignId,
                campaignName: search.campaignName,
                customFields: search.customFields,
            } as any,
        } as any);
    };

    const validateForm = (): boolean => {
        const missingFields: string[] = [];

        customFields.forEach((field) => {
            if (field.isMandatory && !formValues[field.id]?.trim()) {
                missingFields.push(field.fieldName);
            }
        });

        if (missingFields.length > 0) {
            toast.error(t('validation.missingFields', { fields: missingFields.join(', ') }));
            return false;
        }

        return true;
    };

    // Extract email and phone from custom fields for user_dto
    const extractUserInfo = () => {
        let email = '';
        let phone = '';
        let fullName = '';

        customFields.forEach((field) => {
            const value = formValues[field.id] || '';
            const keyLower = field.fieldKey.toLowerCase();
            const nameLower = field.fieldName.toLowerCase();

            if (keyLower.includes('email') || nameLower.includes('email')) {
                if (!email) email = value;
            }
            if (
                keyLower.includes('phone') ||
                keyLower.includes('mobile') ||
                nameLower.includes('phone') ||
                nameLower.includes('mobile')
            ) {
                if (!phone) phone = value;
            }
            // Exact match — `includes('name')` was too loose and swallowed
            // "Center Name", "Branch Name", etc., so the wrong value landed in
            // user_dto.full_name (whichever name-containing field came first).
            if (
                keyLower === 'full_name' ||
                keyLower === 'fullname' ||
                nameLower === 'full name' ||
                nameLower === 'fullname' ||
                nameLower === 'name' ||
                nameLower === 'parent name'
            ) {
                if (!fullName) fullName = value;
            }
        });

        // Try to construct full name from first + last name if not found
        if (!fullName) {
            const firstName =
                customFields.find(
                    (f) =>
                        f.fieldKey.toLowerCase().includes('first_name') ||
                        f.fieldName.toLowerCase().includes('first name')
                )?.id || '';
            const lastName =
                customFields.find(
                    (f) =>
                        f.fieldKey.toLowerCase().includes('last_name') ||
                        f.fieldName.toLowerCase().includes('last name')
                )?.id || '';

            if (firstName || lastName) {
                fullName = `${formValues[firstName] || ''} ${formValues[lastName] || ''}`.trim();
            }
        }

        return { email, phone, fullName };
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
            const { email, phone, fullName } = extractUserInfo();

            const payload: SubmitLeadRequest = {
                audience_id: search.campaignId,
                source_type: 'WALK_IN',
                source_id: search.campaignId,
                custom_field_values: formValues,
                user_dto: {
                    id: '',
                    username: email || '',
                    email: email || '',
                    full_name: fullName || '',
                    address_line: '',
                    city: '',
                    region: '',
                    pin_code: '',
                    mobile_number: phone || '',
                    date_of_birth: null,
                    gender: '',
                    password: '',
                    profile_pic_file_id: '',
                    roles: [],
                    last_login_time: null,
                    root_user: false,
                },
            };

            // Authenticated twin of the open submit endpoint: the token tells the
            // backend who added this lead, which the "only leads assigned to
            // <ROLE>" audience-access option needs in order to stamp the creator
            // as its counsellor. Without it the creator saves a lead and it
            // immediately drops out of their own list.
            await submitAudienceLeadAsAdmin(payload, tSubmitLead);

            toast.success(t('toast.success'));

            // Invalidate the campaign users query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['campaignUsers'] });

            // Navigate back to the users list
            handleBack();
        } catch (error) {
            console.error('Error submitting response:', error);
            toast.error(error instanceof Error ? error.message : t('toast.genericError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Standard system field keys that always represent a phone number with country code.
    // Custom user-created fields with fieldType "number" must NOT be coerced into a phone
    // picker just because their name contains "phone" — only these exact keys are promoted.
    const SYSTEM_PHONE_KEYS = new Set(['phone_number', 'mobile_number']);

    const normalizeFieldType = (field: CustomFieldConfig): string => {
        const normalized = (field.fieldType || 'text').toLowerCase();
        if (normalized === 'phone' || normalized === 'tel') return 'phone';
        if (normalized === 'textfield') return 'text';
        if (SYSTEM_PHONE_KEYS.has((field.fieldKey || '').toLowerCase())) return 'phone';
        return normalized;
    };

    const audienceTerm = getTerminology(OtherTerms.AudienceList, SystemTerms.AudienceList);
    const audienceName =
        search.campaignName || t('audienceFallbackName', { audienceTerm: audienceTerm.toLowerCase() });
    const mandatoryCount = customFields.filter((f) => f.isMandatory).length;

    return (
        <LayoutContainer>
            <Helmet>
                <title>{t('helmet.title', { name: search.campaignName || audienceTerm })}</title>
                <meta name="description" content={t('helmet.description')} />
            </Helmet>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-2">
                <Button variant="ghost" size="sm" onClick={handleBack} className="w-fit">
                    <ArrowLeft className="mr-2 size-4" />
                    {t('backButton', { audienceTerm })}
                </Button>

                <Card className="overflow-hidden border-neutral-200 shadow-sm">
                    <div className="border-b border-neutral-200 bg-primary-50/40 px-6 py-5">
                        <div className="flex items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                                <UsersThree size={20} weight="duotone" />
                            </div>
                            <div className="flex flex-1 flex-col gap-1">
                                <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
                                    {audienceTerm}
                                </p>
                                <h2 className="text-h3 font-semibold text-neutral-900">
                                    {search.campaignName || audienceTerm}
                                </h2>
                                <p className="text-body text-neutral-600">
                                    {t('header.description')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-6">
                        {customFields.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-10 text-center text-neutral-500">
                                <p className="font-medium text-neutral-700">
                                    {t('emptyState.title', { audienceTerm: audienceTerm.toLowerCase() })}
                                </p>
                                <p className="text-sm">{t('emptyState.hint')}</p>
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSubmit();
                                }}
                                className="flex flex-col gap-5"
                            >
                                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                                    <h3 className="text-subtitle font-semibold text-neutral-900">
                                        {t('form.sectionTitle')}
                                    </h3>
                                    {mandatoryCount > 0 && (
                                        <span className="text-caption text-neutral-500">
                                            <span className="text-danger-600">*</span>{' '}
                                            {t('form.requiredFields')}
                                        </span>
                                    )}
                                </div>

                                {customFields.map((field) => (
                                    <div key={field.id} className="flex flex-col gap-2">
                                        <Label
                                            htmlFor={field.id}
                                            className="flex items-center gap-1 text-body font-medium text-neutral-700"
                                        >
                                            {field.fieldName}
                                            {field.isMandatory && (
                                                <span className="text-danger-600">*</span>
                                            )}
                                        </Label>
                                        <CustomFieldRenderer
                                            type={normalizeFieldType(field)}
                                            name={field.fieldName}
                                            value={formValues[field.id] || ''}
                                            onChange={(val) => handleInputChange(field.id, val)}
                                            options={field.options}
                                            required={field.isMandatory}
                                            disabled={isSubmitting}
                                            config={field.fileConfig}
                                        />
                                    </div>
                                ))}

                                <div className="mt-2 flex flex-col-reverse items-stretch justify-end gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={isSubmitting}
                                    >
                                        {t('form.cancel')}
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <Spinner className="mr-2 size-4 animate-spin" />
                                                {t('form.submitting')}
                                            </>
                                        ) : (
                                            <>
                                                <PaperPlaneTilt className="mr-2 size-4" />
                                                {t('form.submit')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <p className="text-center text-caption text-neutral-500">
                    <Trans
                        t={t}
                        i18nKey="footer.responsesAppearUnder"
                        values={{ audienceName, audienceTerm }}
                        components={{ bold: <span className="font-medium" /> }}
                    />
                </p>
            </div>
        </LayoutContainer>
    );
}
