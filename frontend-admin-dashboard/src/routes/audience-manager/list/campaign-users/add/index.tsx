import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { submitAudienceLead, SubmitLeadRequest } from '../../-services/submit-audience-lead';
import { useQueryClient } from '@tanstack/react-query';

const addResponseSearchSchema = z.object({
    campaignId: z.string().min(1, 'Campaign ID is required'),
    campaignName: z.string().optional(),
    customFields: z.string().optional(), // JSON string of custom fields
});

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
}

export function AddResponsePage() {
    const { setNavHeading } = useNavHeadingStore();
    const search = useSearch({ from: Route.id });
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formValues, setFormValues] = useState<Record<string, string>>({});

    useEffect(() => {
        setNavHeading('Add Response');
    }, [setNavHeading]);

    // Parse custom fields from JSON
    const customFields = useMemo<CustomFieldConfig[]>(() => {
        if (!search.customFields) return [];
        try {
            const parsed = JSON.parse(search.customFields);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .map((field: any) => {
                    const customField = field.custom_field || field;
                    return {
                        id: customField.id || field.id,
                        fieldName:
                            customField.fieldName ||
                            customField.field_name ||
                            field.field_name ||
                            '',
                        fieldKey:
                            customField.fieldKey || customField.field_key || field.field_key || '',
                        fieldType:
                            customField.fieldType ||
                            customField.field_type ||
                            field.field_type ||
                            'TEXT',
                        isMandatory: customField.isMandatory ?? field.isMandatory ?? true,
                        defaultValue: customField.defaultValue || field.defaultValue || '',
                        formOrder: customField.formOrder || field.formOrder || 0,
                    };
                })
                .filter((f: CustomFieldConfig) => f.id && f.fieldName)
                .sort(
                    (a: CustomFieldConfig, b: CustomFieldConfig) =>
                        (a.formOrder || 0) - (b.formOrder || 0)
                );
        } catch (error) {
            console.error('Error parsing custom fields:', error);
            return [];
        }
    }, [search.customFields]);

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
            toast.error(`Please fill required fields: ${missingFields.join(', ')}`);
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
            if (
                keyLower.includes('full_name') ||
                keyLower.includes('fullname') ||
                nameLower.includes('full name') ||
                nameLower.includes('name')
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
                source_type: 'AUDIENCE_CAMPAIGN',
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

            await submitAudienceLead(payload);

            toast.success('Response submitted successfully!');

            // Invalidate the campaign users query to refresh the list
            queryClient.invalidateQueries({ queryKey: ['campaignUsers'] });

            // Navigate back to the users list
            handleBack();
        } catch (error) {
            console.error('Error submitting response:', error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : 'Failed to submit response. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInputType = (fieldType: string): string => {
        switch (fieldType.toUpperCase()) {
            case 'EMAIL':
                return 'email';
            case 'NUMBER':
                return 'number';
            case 'DATE':
                return 'date';
            case 'PHONE':
            case 'TEL':
                return 'tel';
            default:
                return 'text';
        }
    };

    return (
        <LayoutContainer>
            <Helmet>
                <title>Add Response - {search.campaignName || 'Campaign'}</title>
                <meta name="description" content="Add a response on behalf of a respondent." />
            </Helmet>
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
                <Button variant="ghost" size="sm" onClick={handleBack} className="w-fit">
                    <ArrowLeft className="mr-2 size-4" />
                    Back to Campaign Users
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Add Response</CardTitle>
                        <CardDescription>
                            Fill in the details below to submit a response on behalf of a respondent
                            for{' '}
                            <span className="font-medium text-neutral-900">
                                {search.campaignName || 'this campaign'}
                            </span>
                            .
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {customFields.length === 0 ? (
                            <div className="py-8 text-center text-neutral-500">
                                <p>No form fields configured for this campaign.</p>
                                <p className="mt-2 text-sm">
                                    Please add custom fields to the campaign first.
                                </p>
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSubmit();
                                }}
                                className="space-y-4"
                            >
                                {customFields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <Label
                                            htmlFor={field.id}
                                            className="flex items-center gap-1"
                                        >
                                            {field.fieldName}
                                            {field.isMandatory && (
                                                <span className="text-red-500">*</span>
                                            )}
                                        </Label>
                                        <Input
                                            id={field.id}
                                            type={getInputType(field.fieldType)}
                                            value={formValues[field.id] || ''}
                                            onChange={(e) =>
                                                handleInputChange(field.id, e.target.value)
                                            }
                                            placeholder={`Enter ${field.fieldName.toLowerCase()}`}
                                            required={field.isMandatory}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                ))}

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 size-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 size-4" />
                                                Submit Response
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </LayoutContainer>
    );
}
