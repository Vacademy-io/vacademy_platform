import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState } from 'react';
import {
    AnnouncementService,
    type CreateAnnouncementRequest,
    type ModeType,
} from '@/services/announcement';
import { getUserId, getUserName } from '@/utils/userDetails';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import useLocalStorage from '@/hooks/use-local-storage';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
const TipTapEditor = lazy(() =>
    import('@/components/tiptap/TipTapEditor').then((module) => ({ default: module.TipTapEditor }))
);
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Smartphone, Tablet, Laptop, Plus } from 'lucide-react';
import { MultiSelect, type OptionType } from '@/components/design-system/multi-select';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { TIMEZONE_OPTIONS } from '@/routes/study-library/live-session/schedule/-constants/options';
import { getInstituteTags, getUserCountsByTags, type TagItem } from '@/services/tag-management';
import { getInstituteId } from '@/constants/helper';
import { getUserRoleForInstitute } from '@/lib/auth/instituteUtils';
import { getMessageTemplates, getMessageTemplate } from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    getEmailConfigurations,
    type EmailConfiguration,
} from '@/services/email-configuration-service';
import {
    getCustomFieldSettings,
    type CustomField,
    type FixedField,
    type GroupField,
} from '@/services/custom-field-settings';
import { useCampaignsList } from '@/routes/audience-manager/list/-hooks/useCampaignsList';
import type { CampaignItem } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';

export const Route = createLazyFileRoute('/announcement/email-campaigning/')({
    component: () => (
        <LayoutContainer>
            <EmailCampaigningPage />
        </LayoutContainer>
    ),
});

function EmailCampaigningPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const navigate = useNavigate();

    // Institute details for package sessions
    const { instituteDetails } = useInstituteDetailsStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Basic state
    const [title, setTitle] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [contentView, setContentView] = useState<'editor' | 'source'>('editor');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'laptop'>('laptop');
    const DEVICE_PRESETS: Record<typeof previewDevice, { label: string; width: number }> = {
        mobile: { label: 'Mobile', width: 390 },
        tablet: { label: 'Tablet', width: 768 },
        laptop: { label: 'Laptop', width: 1280 },
    };

    // Only SYSTEM_ALERT mode for email campaigning (general announcement)
    const [modeSettings, setModeSettings] = useState<Record<ModeType, Record<string, unknown>>>({
        SYSTEM_ALERT: { priority: 'MEDIUM', expiresAt: '' },
        DASHBOARD_PIN: {},
        DM: {},
        STREAM: {},
        RESOURCES: {},
        COMMUNITY: {},
        TASKS: {},
    });

    const [recipients, setRecipients] = useState<CreateAnnouncementRequest['recipients']>([]);

    // For TAG recipient rows
    const [tagSelections, setTagSelections] = useState<Record<number, string[]>>({});
    const [tagOptions, setTagOptions] = useState<OptionType[]>([]);
    const [tagMapById, setTagMapById] = useState<Record<string, TagItem>>({});
    const [tagsLoading, setTagsLoading] = useState(false);
    const [estimatedUsers, setEstimatedUsers] = useState<number | null>(null);
    const [estimatingUsers, setEstimatingUsers] = useState(false);
    const [rowTagEstimates, setRowTagEstimates] = useState<Record<number, number | null>>({});

    // For CUSTOM_FIELD recipient rows
    const [customFieldOptions, setCustomFieldOptions] = useState<
        Array<{
            id: string;
            name: string;
            type: 'text' | 'dropdown' | 'number';
            options?: string[];
        }>
    >([]);
    const [customFieldFilters, setCustomFieldFilters] = useState<
        Record<
            number,
            Array<{
                fieldId: string;
                fieldName: string;
                fieldType: 'text' | 'dropdown' | 'number';
                filterValue?: string | string[];
                operator?: 'equals' | 'contains' | 'starts_with' | 'ends_with';
            }>
        >
    >({});

    const [scheduleType, setScheduleType] = useState<'IMMEDIATE' | 'ONE_TIME' | 'RECURRING'>(
        'IMMEDIATE'
    );

    // Persist timezone in localStorage
    const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const { getValue: getSavedTz, setValue: setSavedTz } = useLocalStorage<string>(
        'email_campaign_timezone',
        defaultTz
    );
    const [timezone, setTimezone] = useState<string>(getSavedTz());
    const [oneTimeStart, setOneTimeStart] = useState<string>('');
    const [cronExpression, setCronExpression] = useState<string>('');
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    // Template-related state
    const [useTemplate, setUseTemplate] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [emailTemplates, setEmailTemplates] = useState<MessageTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [templatesError, setTemplatesError] = useState<string | null>(null);

    // Email configuration state
    const [emailConfigurations, setEmailConfigurations] = useState<EmailConfiguration[]>([]);
    const [selectedFromEmail, setSelectedFromEmail] = useState<string>('');
    const [emailConfigsLoading, setEmailConfigsLoading] = useState(false);

    // Package session selection state
    const [packageSessionOptions, setPackageSessionOptions] = useState<
        Array<{
            id: string;
            label: string;
            is_org_associated?: boolean;
        }>
    >([]);

    // Track selected role for sub-org batches (Admin or Learner)
    const [batchRoleSelections, setBatchRoleSelections] = useState<
        Record<number, 'ADMIN' | 'LEARNER'>
    >({});

    // Campaign options state
    const [campaignOptions, setCampaignOptions] = useState<CampaignItem[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);

    // Exclusion state - per recipient row
    const [recipientExclusions, setRecipientExclusions] = useState<
        Record<
            number,
            Array<{
                id: string;
                recipientType: 'ROLE' | 'USER' | 'PACKAGE_SESSION' | 'TAG';
                recipientId: string;
                recipientName: string;
            }>
        >
    >({});

    useEffect(() => {
        setNavHeading('Email Campaigning');
    }, [setNavHeading]);

    // Load institute tags for TAG recipients
    useEffect(() => {
        (async () => {
            setTagsLoading(true);
            try {
                const tags = await getInstituteTags();
                const options = tags.map((t) => ({ label: t.tagName, value: t.id }));
                const map: Record<string, TagItem> = {};
                tags.forEach((t) => {
                    map[t.id] = t;
                });
                setTagOptions(options);
                setTagMapById(map);
            } finally {
                setTagsLoading(false);
            }
        })();
    }, []);

    // Load custom fields for CUSTOM_FIELD recipients
    useEffect(() => {
        (async () => {
            try {
                // Fetch from API if cache is empty, otherwise use cache
                const settings = await getCustomFieldSettings();
                if (settings) {
                    const allFields: Array<{
                        id: string;
                        name: string;
                        type: 'text' | 'dropdown' | 'number';
                        options?: string[];
                    }> = [];

                    // Add fixed fields (if they have appropriate types)
                    settings.fixedFields.forEach((field: FixedField) => {
                        // Only include if it's a filterable type
                        allFields.push({
                            id: field.id,
                            name: field.name,
                            type: 'text', // Fixed fields are typically text
                        });
                    });

                    // Add institute fields
                    settings.instituteFields.forEach((field: CustomField) => {
                        allFields.push({
                            id: field.id,
                            name: field.name,
                            type: field.type,
                            options: field.options,
                        });
                    });

                    // Add custom fields
                    settings.customFields.forEach((field: CustomField) => {
                        allFields.push({
                            id: field.id,
                            name: field.name,
                            type: field.type,
                            options: field.options,
                        });
                    });

                    // Add group fields
                    settings.fieldGroups.forEach((group) => {
                        group.fields.forEach((field: GroupField) => {
                            allFields.push({
                                id: field.id,
                                name: field.name,
                                type: field.type,
                                options: field.options,
                            });
                        });
                    });

                    setCustomFieldOptions(allFields);
                }
            } catch (error) {
                console.error('Error loading custom fields:', error);
                // On error, set empty array so buttons don't show
                setCustomFieldOptions([]);
            }
        })();
    }, []);

    // Load email templates
    const loadEmailTemplates = async () => {
        if (emailTemplates.length > 0 || templatesLoading) return;

        setTemplatesLoading(true);
        setTemplatesError(null);
        try {
            const response = await getMessageTemplates('EMAIL');
            setEmailTemplates(response.templates);
        } catch (error) {
            console.error('Error loading email templates:', error);
            setTemplatesError('Failed to load email templates. Please try again.');
            // Set empty array on error to prevent further issues
            setEmailTemplates([]);
        } finally {
            setTemplatesLoading(false);
        }
    };

    // Load email configurations
    useEffect(() => {
        const loadEmailConfigurations = async () => {
            setEmailConfigsLoading(true);
            try {
                const configs = await getEmailConfigurations();
                setEmailConfigurations(configs);

                if (configs.length > 0) {
                    const persistedEmail =
                        typeof window !== 'undefined'
                            ? localStorage.getItem('selectedFromEmail')
                            : null;

                    if (
                        persistedEmail &&
                        configs.find((c) => `${c.email} -${c.name} ` === persistedEmail)
                    ) {
                        setSelectedFromEmail(persistedEmail);
                    } else {
                        const defaultValue = `${configs[0]?.email} -${configs[0]?.name} `;
                        setSelectedFromEmail(defaultValue || '');
                    }
                }
            } catch (error) {
                console.error('Error loading email configurations:', error);
            } finally {
                setEmailConfigsLoading(false);
            }
        };
        loadEmailConfigurations();
    }, []);

    // Persist selectedFromEmail to localStorage
    useEffect(() => {
        if (selectedFromEmail && typeof window !== 'undefined') {
            localStorage.setItem('selectedFromEmail', selectedFromEmail);
        }
    }, [selectedFromEmail]);

    // Load package session options
    useEffect(() => {
        if (instituteDetails?.batches_for_sessions) {
            const options = instituteDetails.batches_for_sessions.map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name} `,
                is_org_associated: (batch as any).is_org_associated || false,
            }));
            setPackageSessionOptions(options);
        }
    }, [instituteDetails]);

    // Load campaigns list
    const instituteId = getInstituteId() || '';
    const campaignsPayload = useMemo(
        () => ({
            institute_id: instituteId,
            page: 0,
            size: 1000, // Fetch a large number to get all campaigns
        }),
        [instituteId]
    );

    const { data: campaignsList, isLoading: campaignsListLoading } =
        useCampaignsList(campaignsPayload);

    useEffect(() => {
        if (campaignsList?.content) {
            // Filter campaigns to only show ACTIVE, INACTIVE, or DRAFT status
            const filteredCampaigns = campaignsList.content.filter((campaign: CampaignItem) => {
                const normalizedStatus = campaign.status?.trim().toUpperCase();
                return ['ACTIVE', 'INACTIVE', 'DRAFT'].includes(normalizedStatus);
            });
            setCampaignOptions(filteredCampaigns);
        } else {
            setCampaignOptions([]);
        }
        setCampaignsLoading(campaignsListLoading);
    }, [campaignsList, campaignsListLoading]);

    // Estimate users for selected tags
    useEffect(() => {
        const allTagIds = Array.from(new Set(Object.values(tagSelections).flat().filter(Boolean)));
        if (allTagIds.length === 0) {
            setEstimatedUsers(null);
            return;
        }
        let cancelled = false;
        (async () => {
            setEstimatingUsers(true);
            try {
                const res = await getUserCountsByTags(allTagIds);
                if (!cancelled) setEstimatedUsers(res?.totalUsers ?? null);
            } catch {
                if (!cancelled) setEstimatedUsers(null);
            } finally {
                if (!cancelled) setEstimatingUsers(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tagSelections]);

    // Per-row tag estimates
    useEffect(() => {
        const rowIndexes = Object.keys(tagSelections).map(Number);
        const estimatePromises = rowIndexes.map(async (idx) => {
            const tagIds = tagSelections[idx];
            if (!tagIds || tagIds.length === 0) {
                return { idx, count: null };
            }
            try {
                const res = await getUserCountsByTags(tagIds);
                return { idx, count: res?.totalUsers ?? null };
            } catch {
                return { idx, count: null };
            }
        });

        Promise.all(estimatePromises).then((results) => {
            const newEstimates: Record<number, number | null> = {};
            results.forEach(({ idx, count }) => {
                newEstimates[idx] = count;
            });
            setRowTagEstimates(newEstimates);
        });
    }, [tagSelections, tagMapById]);

    // Persist timezone changes to localStorage
    useEffect(() => {
        setSavedTz(timezone);
    }, [timezone, setSavedTz]);

    const handleTemplateSelection = async (templateId: string) => {
        try {
            // Fetch full template content from API
            const fullTemplate = await getMessageTemplate(templateId);
            setSelectedTemplateId(templateId);
            if (fullTemplate.subject) {
                setTitle(fullTemplate.subject);
            }
            if (fullTemplate.content) {
                setHtmlContent(fullTemplate.content);
            }
        } catch (error) {
            console.error('Error loading template:', error);
            toast({
                title: 'Error',
                description: 'Failed to load template content. Using cached version.',
                variant: 'destructive',
            });
            // Fallback to cached template if API fails
            const template = emailTemplates.find((t) => t.id === templateId);
            if (template) {
                setSelectedTemplateId(templateId);
                if (template.subject) {
                    setTitle(template.subject);
                }
                if (template.content) {
                    setHtmlContent(template.content);
                }
            }
        }
    };

    const addRecipientPreset = (preset: 'ALL_STUDENTS' | 'ALL_TEACHERS') => {
        if (preset === 'ALL_STUDENTS') {
            setRecipients((prev) => [
                ...prev,
                { recipientType: 'ROLE', recipientId: 'STUDENT', recipientName: '' },
            ]);
            return;
        }
        if (preset === 'ALL_TEACHERS') {
            setRecipients((prev) => [
                ...prev,
                { recipientType: 'ROLE', recipientId: 'TEACHER', recipientName: '' },
            ]);
            return;
        }
    };

    const addBatchRecipient = () => {
        const firstBatch = packageSessionOptions[0];
        if (firstBatch) {
            setRecipients((prev) => [
                ...prev,
                {
                    recipientType: 'PACKAGE_SESSION',
                    recipientId: firstBatch.id,
                    recipientName: firstBatch.label,
                },
            ]);
        } else {
            setRecipients((prev) => [
                ...prev,
                {
                    recipientType: 'PACKAGE_SESSION',
                    recipientId: '',
                    recipientName: '',
                },
            ]);
        }
    };

    const addExclusion = (recipientIdx: number) => {
        setRecipientExclusions((prev) => {
            const current = prev[recipientIdx] || [];
            return {
                ...prev,
                [recipientIdx]: [
                    ...current,
                    {
                        id: `exclusion - ${Date.now()} -${recipientIdx} `,
                        recipientType: 'ROLE',
                        recipientId: '',
                        recipientName: '',
                    },
                ],
            };
        });
    };

    const removeExclusion = (recipientIdx: number, id: string) => {
        setRecipientExclusions((prev) => {
            const current = prev[recipientIdx] || [];
            return {
                ...prev,
                [recipientIdx]: current.filter((e) => e.id !== id),
            };
        });
    };

    const updateExclusion = (
        recipientIdx: number,
        id: string,
        field: 'recipientType' | 'recipientId' | 'recipientName',
        value: string
    ) => {
        setRecipientExclusions((prev) => {
            const current = prev[recipientIdx] || [];
            return {
                ...prev,
                [recipientIdx]: current.map((e) => {
                    if (e.id === id) {
                        // If changing recipientType, reset recipientId and recipientName
                        if (field === 'recipientType') {
                            return {
                                ...e,
                                [field]: value as 'ROLE' | 'USER' | 'PACKAGE_SESSION' | 'TAG',
                                recipientId: '',
                                recipientName: '',
                            };
                        }
                        return { ...e, [field]: value };
                    }
                    return e;
                }),
            };
        });
    };

    const removeRecipientAtIndex = (idx: number) => {
        setRecipients((prev) => prev.filter((_, i) => i !== idx));
        setTagSelections((prev) => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
        setCustomFieldFilters((prev) => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
        setRecipientExclusions((prev) => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
        setBatchRoleSelections((prev) => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
    };

    const addCustomFieldFilter = (recipientIdx: number) => {
        setCustomFieldFilters((prev) => {
            const current = prev[recipientIdx] || [];
            return {
                ...prev,
                [recipientIdx]: [
                    ...current,
                    {
                        fieldId: '',
                        fieldName: '',
                        fieldType: 'text',
                        filterValue: '',
                        operator: 'equals',
                    },
                ],
            };
        });
    };

    const removeCustomFieldFilter = (recipientIdx: number, filterIdx: number) => {
        setCustomFieldFilters((prev) => {
            const current = prev[recipientIdx] || [];
            const updated = current.filter((_, i) => i !== filterIdx);
            return {
                ...prev,
                [recipientIdx]: updated,
            };
        });
    };

    const updateCustomFieldFilter = (
        recipientIdx: number,
        filterIdx: number,
        updates: Partial<{
            fieldId: string;
            fieldName: string;
            fieldType: 'text' | 'dropdown' | 'number';
            filterValue: string | string[];
            operator: 'equals' | 'contains' | 'starts_with' | 'ends_with';
        }>
    ) => {
        setCustomFieldFilters((prev) => {
            const current = prev[recipientIdx] || [];
            const updated = current.map((filter, i) =>
                i === filterIdx ? { ...filter, ...updates } : filter
            );
            return {
                ...prev,
                [recipientIdx]: updated,
            };
        });
    };

    const dateToLocalInput = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year} -${month} -${day}T${hours}:${minutes} `;
    };

    const applyScheduleQuickPick = (pick: 'NOW' | 'IN_1H' | 'TOMORROW_9AM' | 'NEXT_MON_9AM') => {
        const target = new Date();
        if (pick === 'NOW') {
            setScheduleType('IMMEDIATE');
            return;
        }
        if (pick === 'IN_1H') {
            target.setHours(target.getHours() + 1);
        } else if (pick === 'TOMORROW_9AM') {
            target.setDate(target.getDate() + 1);
            target.setHours(9, 0, 0, 0);
        } else if (pick === 'NEXT_MON_9AM') {
            const day = target.getDay();
            const delta = (8 - day) % 7 || 7;
            target.setDate(target.getDate() + delta);
            target.setHours(9, 0, 0, 0);
        }
        setScheduleType('ONE_TIME');
        setOneTimeStart(dateToLocalInput(target));
    };

    const applyCronTemplate = (tmpl: 'DAILY_9' | 'MON_9' | 'HOURLY') => {
        if (tmpl === 'DAILY_9') setCronExpression('0 0 9 * * ?');
        else if (tmpl === 'MON_9') setCronExpression('0 0 9 ? * MON');
        else if (tmpl === 'HOURLY') setCronExpression('0 0 * * * ?');
        setScheduleType('RECURRING');
    };

    const reviewRecipientItems = useMemo(() => {
        const items: Array<{ type: string; text: string }> = [];
        recipients.forEach((r, idx) => {
            if (r.recipientType === 'TAG') {
                const ids = tagSelections[idx] || [];
                ids.forEach((tagId) => {
                    const tag = tagMapById[tagId];
                    items.push({ type: 'TAG', text: tag?.tagName || tagId });
                });
            } else if (r.recipientType === 'CUSTOM_FIELD_FILTER') {
                const filters = customFieldFilters[idx] || [];
                const filterText = filters
                    .filter((f) => f.fieldId && f.filterValue)
                    .map(
                        (f) =>
                            `${f.fieldName}: ${Array.isArray(f.filterValue) ? f.filterValue.join(', ') : f.filterValue} `
                    )
                    .join('; ');
                items.push({ type: 'CUSTOM_FIELD_FILTER', text: filterText || '—' });
            } else {
                items.push({
                    type:
                        r.recipientType === 'PACKAGE_SESSION'
                            ? getTerminology(ContentTerms.Batch, SystemTerms.Batch)
                            : r.recipientType,
                    text:
                        r.recipientType === 'PACKAGE_SESSION'
                            ? packageSessionOptions.find((opt) => opt.id === r.recipientId)
                                  ?.label ||
                              r.recipientId ||
                              '—'
                            : r.recipientId || r.recipientName || '—',
                });
            }
        });
        return items;
    }, [recipients, tagSelections, tagMapById, packageSessionOptions]);

    const handleSubmit = async () => {
        try {
            // Validate required fields
            const validationErrors: string[] = [];
            const fieldErrors: Record<string, string> = {};
            const trimmedTitle = title.trim();
            const trimmedContent = htmlContent.trim();

            if (!trimmedTitle) {
                validationErrors.push('Title is required');
                fieldErrors.title = 'Title is required';
            }
            if (!trimmedContent) {
                validationErrors.push('Content is required');
                fieldErrors.content = 'Content is required';
            }

            // Validate SYSTEM_ALERT mode settings
            const s = (modeSettings.SYSTEM_ALERT || {}) as Record<string, unknown>;
            const p = (s.priority as string) || '';
            if (!p) {
                validationErrors.push('Priority is required');
                fieldErrors['modes.SYSTEM_ALERT.priority'] = 'Priority is required';
            }

            // Scheduling validations
            if (scheduleType === 'ONE_TIME') {
                if (!oneTimeStart) {
                    validationErrors.push('Schedule: run time is required');
                    fieldErrors['schedule.startDate'] = 'Run time is required';
                }
            }
            if (scheduleType === 'RECURRING') {
                if (!cronExpression) {
                    validationErrors.push('Schedule: cron expression is required for recurring');
                    fieldErrors['schedule.cronExpression'] = 'Cron expression is required';
                }
            }

            if (validationErrors.length > 0) {
                setErrors(fieldErrors);
                toast({
                    title: 'Missing required fields',
                    description: validationErrors.slice(0, 4).join('\n'),
                    variant: 'destructive',
                });
                return;
            }
            setErrors({});

            // Validate TAG recipients
            const anyTagRow = recipients.some((r) => r.recipientType === 'TAG');
            if (anyTagRow) {
                const missingTags = recipients.some(
                    (r, idx) => r.recipientType === 'TAG' && !tagSelections[idx]?.length
                );
                if (missingTags) {
                    toast({
                        title: 'Select at least one tag',
                        description: 'You have a TAG recipient without any selected tags.',
                        variant: 'destructive',
                    });
                    return;
                }
                const instId = getInstituteId();
                if (!instId) {
                    toast({
                        title: 'Institute required',
                        description: 'An institute must be selected to target TAG recipients.',
                        variant: 'destructive',
                    });
                    return;
                }
            }

            // Validate CUSTOM_FIELD_FILTER recipients
            const anyCustomFieldRow = recipients.some(
                (r) => r.recipientType === 'CUSTOM_FIELD_FILTER'
            );
            if (anyCustomFieldRow) {
                const missingFilters = recipients.some((r, idx) => {
                    if (r.recipientType !== 'CUSTOM_FIELD_FILTER') return false;
                    const filters = customFieldFilters[idx];
                    return !filters || !filters.some((f) => f.fieldId && f.filterValue);
                });
                if (missingFilters) {
                    toast({
                        title: 'Configure custom field filters',
                        description:
                            'You have a Custom Field Filter recipient without any configured filters.',
                        variant: 'destructive',
                    });
                    return;
                }
            }

            // Expand TAG selections and CUSTOM_FIELD filters into recipient entries
            const expandedRecipients: CreateAnnouncementRequest['recipients'] = [];
            recipients.forEach((r, idx) => {
                // Get per-recipient exclusions
                const recipientExclusionsList = recipientExclusions[idx] || [];
                const validRecipientExclusions = recipientExclusionsList
                    .filter((e) => e.recipientId && e.recipientId.trim() !== '')
                    .map((e) => ({
                        exclusionType: e.recipientType as
                            | 'USER'
                            | 'ROLE'
                            | 'PACKAGE_SESSION'
                            | 'TAG',
                        exclusionId: e.recipientId,
                    }));

                // Get per-recipient custom field filters
                const recipientCustomFieldFilters = customFieldFilters[idx] || [];
                const validCustomFieldFilters = recipientCustomFieldFilters
                    .filter((f) => f.fieldId && f.filterValue)
                    .map((f) => {
                        const fieldValue = Array.isArray(f.filterValue)
                            ? f.filterValue
                            : f.filterValue || '';

                        return {
                            customFieldId: f.fieldId,
                            fieldName: f.fieldName, // Fallback for backward compatibility
                            fieldValue: fieldValue,
                            operator: f.operator,
                        };
                    });

                if (r.recipientType === 'TAG') {
                    const ids = tagSelections[idx] || [];
                    ids.forEach((tagId) => {
                        const tag = tagMapById[tagId];
                        expandedRecipients.push({
                            recipientType: 'TAG',
                            recipientId: tagId,
                            recipientName: tag?.tagName,
                            customFieldFilters:
                                validCustomFieldFilters.length > 0
                                    ? validCustomFieldFilters
                                    : undefined,
                            exclusions:
                                validRecipientExclusions.length > 0
                                    ? validRecipientExclusions
                                    : undefined,
                        });
                    });
                } else if (r.recipientType === 'CUSTOM_FIELD_FILTER') {
                    if (validCustomFieldFilters.length > 0) {
                        // Only add if at least one filter is configured
                        expandedRecipients.push({
                            recipientType: 'CUSTOM_FIELD_FILTER',
                            recipientId: r.recipientId || `custom - filter - ${idx} `,
                            recipientName: r.recipientName,
                            customFieldFilters: validCustomFieldFilters,
                            exclusions:
                                validRecipientExclusions.length > 0
                                    ? validRecipientExclusions
                                    : undefined,
                        });
                    }
                } else if (r.recipientType === 'PACKAGE_SESSION' && r.recipientId) {
                    const batchOption = packageSessionOptions.find(
                        (opt) => opt.id === r.recipientId
                    );
                    const selectedRole = batchRoleSelections[idx];

                    // Check if it's a sub-org batch with role selection
                    if (batchOption?.is_org_associated && selectedRole) {
                        // Use PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES format: packageSessionId:ROLE1,ROLE2
                        expandedRecipients.push({
                            recipientType: 'PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES',
                            recipientId: `${r.recipientId}:${selectedRole} `,
                            recipientName: `${batchOption.label} (${selectedRole})`,
                            customFieldFilters:
                                validCustomFieldFilters.length > 0
                                    ? validCustomFieldFilters
                                    : undefined,
                            exclusions:
                                validRecipientExclusions.length > 0
                                    ? validRecipientExclusions
                                    : undefined,
                        });
                    } else {
                        // Regular PACKAGE_SESSION
                        expandedRecipients.push({
                            recipientType: 'PACKAGE_SESSION',
                            recipientId: r.recipientId,
                            recipientName: r.recipientName || batchOption?.label,
                            customFieldFilters:
                                validCustomFieldFilters.length > 0
                                    ? validCustomFieldFilters
                                    : undefined,
                            exclusions:
                                validRecipientExclusions.length > 0
                                    ? validRecipientExclusions
                                    : undefined,
                        });
                    }
                } else if (r.recipientType && r.recipientId) {
                    expandedRecipients.push({
                        recipientType: r.recipientType,
                        recipientId: r.recipientId,
                        recipientName: r.recipientName,
                        customFieldFilters:
                            validCustomFieldFilters.length > 0
                                ? validCustomFieldFilters
                                : undefined,
                        exclusions:
                            validRecipientExclusions.length > 0
                                ? validRecipientExclusions
                                : undefined,
                    });
                }
            });

            setIsSubmitting(true);
            const selectedConfig = emailConfigurations.find(
                (c) => `${c.email} -${c.name} ` === selectedFromEmail
            );
            const emailType = selectedConfig?.type || 'UTILITY_EMAIL';

            const primaryRole = getUserRoleForInstitute(getInstituteId() || '') || 'UNKNOWN';

            const payload: CreateAnnouncementRequest = {
                title,
                content: { type: 'html', content: htmlContent },
                instituteId: getInstituteId() || '',
                createdBy: getUserId(),
                createdByName: getUserName(),
                createdByRole: primaryRole,
                recipients: expandedRecipients,
                // Global exclusions are currently not processed, but kept for backward compatibility
                exclusions: undefined,
                modes: [
                    {
                        modeType: 'SYSTEM_ALERT',
                        settings: modeSettings.SYSTEM_ALERT ?? {},
                    },
                ],
                mediums: [
                    {
                        mediumType: 'EMAIL',
                        config: {
                            subject: title,
                            emailType: emailType,
                        },
                    },
                ],
                scheduling:
                    scheduleType === 'IMMEDIATE'
                        ? { scheduleType, timezone }
                        : scheduleType === 'ONE_TIME'
                          ? {
                                scheduleType,
                                timezone,
                                startDate: oneTimeStart
                                    ? new Date(oneTimeStart).toISOString()
                                    : undefined,
                            }
                          : {
                                scheduleType,
                                timezone,
                                cronExpression: cronExpression || undefined,
                            },
            };

            await AnnouncementService.create(payload);

            try {
                const { toast: sonnerToast } = await import('sonner');
                sonnerToast.success('Email campaign created successfully');
            } catch {
                toast({ title: 'Email campaign created successfully' });
            }

            // Reset fields
            setTitle('');
            setHtmlContent('');
            setModeSettings({
                SYSTEM_ALERT: { priority: 'MEDIUM', expiresAt: '' },
                DASHBOARD_PIN: {},
                DM: {},
                STREAM: {},
                RESOURCES: {},
                COMMUNITY: {},
                TASKS: {},
            });
        } catch (err: unknown) {
            const anyErr = err as {
                response?: {
                    data?: {
                        details?: Record<string, string>;
                        message?: string;
                    };
                };
            };
            const details = anyErr?.response?.data?.details as Record<string, string> | undefined;

            if (details && typeof details === 'object') {
                const fieldErrors: Record<string, string> = {};
                Object.entries(details).forEach(([key, message]) => {
                    if (key.startsWith('scheduling.')) {
                        const localKey = `schedule.${key.split('.').slice(1).join('.')} `;
                        fieldErrors[localKey] = message;
                    } else if (key.startsWith('content.')) {
                        fieldErrors['content'] = message;
                    } else if (key === 'title') {
                        fieldErrors['title'] = message;
                    } else {
                        fieldErrors[key] = message;
                    }
                });

                setErrors((prev) => ({ ...prev, ...fieldErrors }));

                const msg = Object.values(details).slice(0, 5).join('\n');
                toast({
                    title: 'Please fix the highlighted fields',
                    description: msg,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Failed to create',
                    description:
                        anyErr?.response?.data?.message ||
                        (err instanceof Error ? err.message : 'Try again'),
                    variant: 'destructive',
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold">Email Campaigning</h2>
            <div className="mt-6 grid max-w-3xl gap-8">
                {/* Review Dialog */}
                <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Review Email Campaign</DialogTitle>
                            <DialogDescription>Confirm details before creating.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div>
                                <div className="text-sm font-medium">Title</div>
                                <div className="text-sm text-neutral-700">{title || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Mode</div>
                                <div className="text-sm text-neutral-700">
                                    SYSTEM_ALERT (General Announcement)
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Medium</div>
                                <div className="text-sm text-neutral-700">EMAIL</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Audience</div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {reviewRecipientItems.length === 0 && <span>—</span>}
                                    {reviewRecipientItems.map((it, i) => (
                                        <span key={i} className="rounded-full border px-2 py-0.5">
                                            <span className="font-medium">{it.type}</span>
                                            <span>{' : '}</span>
                                            <span>{it.text}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Schedule</div>
                                <div className="text-sm text-neutral-700">
                                    {scheduleType === 'IMMEDIATE' && `IMMEDIATE(${timezone})`}
                                    {scheduleType === 'ONE_TIME' &&
                                        `ONE_TIME at ${oneTimeStart || '—'} (${timezone})`}
                                    {scheduleType === 'RECURRING' &&
                                        `RECURRING ${cronExpression || '—'} (${timezone})`}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsReviewOpen(false)}>
                                Back
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsReviewOpen(false);
                                    handleSubmit();
                                }}
                                disabled={isSubmitting}
                            >
                                Confirm & Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Preview Dialog */}
                <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <DialogContent className="max-w-5xl">
                        <DialogHeader>
                            <DialogTitle>Email Preview</DialogTitle>
                        </DialogHeader>
                        <div className="flex items-center justify-center gap-2">
                            <Button
                                variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPreviewDevice('mobile')}
                            >
                                <Smartphone className="mr-1 size-4" />
                                Mobile
                            </Button>
                            <Button
                                variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPreviewDevice('tablet')}
                            >
                                <Tablet className="mr-1 size-4" />
                                Tablet
                            </Button>
                            <Button
                                variant={previewDevice === 'laptop' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPreviewDevice('laptop')}
                            >
                                <Laptop className="mr-1 size-4" />
                                Laptop
                            </Button>
                        </div>
                        <div className="flex justify-center">
                            <div
                                style={{ width: DEVICE_PRESETS[previewDevice].width }}
                                className="border bg-white p-4 shadow-sm"
                            >
                                <div className="mb-2 border-b pb-2">
                                    <div className="text-sm font-semibold">
                                        {title || 'Email Subject'}
                                    </div>
                                </div>
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{
                                        __html: htmlContent || '<p>No content</p>',
                                    }}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Basic */}
                <section className="grid gap-3">
                    <Label>Title / Email Subject</Label>
                    <Input
                        placeholder="Email Subject"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={errors.title ? 'border-red-500' : ''}
                    />
                    {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}

                    <Label>Email Content</Label>
                    <div className="flex items-center gap-2 self-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setContentView('editor')}
                            disabled={contentView === 'editor'}
                        >
                            Rich Editor
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setContentView('source')}
                            disabled={contentView === 'source'}
                        >
                            HTML Source
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsPreviewOpen(true)}
                            disabled={isPreviewOpen}
                        >
                            Preview
                        </Button>
                    </div>
                    {contentView === 'editor' && (
                        <div
                            className={`bg - white rounded border ${errors.content ? 'border-red-500' : 'border-transparent'} `}
                        >
                            <Suspense
                                fallback={
                                    <div className="flex h-40 items-center justify-center border bg-white">
                                        <Loader2 className="animate-spin" />
                                    </div>
                                }
                            >
                                <TipTapEditor
                                    value={htmlContent}
                                    onChange={setHtmlContent}
                                    onBlur={() => {}}
                                    placeholder={'Write the email content'}
                                    minHeight={160}
                                />
                            </Suspense>
                        </div>
                    )}
                    {contentView === 'source' && (
                        <Textarea
                            placeholder="HTML source"
                            value={htmlContent}
                            onChange={(e) => setHtmlContent(e.target.value)}
                            rows={10}
                            className={errors.content ? 'border-red-500' : ''}
                        />
                    )}
                    {errors.content && <p className="text-xs text-red-600">{errors.content}</p>}
                </section>

                <Separator />

                {/* Email Template Section */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Email Template</h3>

                    <div className="mb-4 flex items-center gap-2">
                        <Checkbox
                            id="use-template"
                            checked={useTemplate}
                            onCheckedChange={async (checked) => {
                                setUseTemplate(Boolean(checked));
                                if (checked) {
                                    await loadEmailTemplates();
                                } else {
                                    setSelectedTemplateId('');
                                }
                            }}
                        />
                        <Label htmlFor="use-template" className="text-sm font-medium">
                            Use Email Template
                        </Label>
                    </div>

                    {useTemplate && (
                        <div className="mb-4">
                            <Label className="mb-2 block text-sm font-medium">
                                Select Template
                            </Label>
                            <Select
                                value={selectedTemplateId}
                                onValueChange={(value) => {
                                    if (value === 'add-new-template') {
                                        navigate({
                                            to: '/settings',
                                            search: { selectedTab: 'templates' },
                                        });
                                    } else {
                                        handleTemplateSelection(value);
                                    }
                                }}
                                disabled={templatesLoading}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            templatesLoading
                                                ? 'Loading templates...'
                                                : 'Select a template'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {emailTemplates.length > 0 ? (
                                        <>
                                            {emailTemplates
                                                .filter(
                                                    (template) =>
                                                        template.id && template.id.trim() !== ''
                                                )
                                                .map((template) => (
                                                    <SelectItem
                                                        key={template.id}
                                                        value={template.id}
                                                    >
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            <Separator className="my-1" />
                                            <SelectItem
                                                value="add-new-template"
                                                className="font-medium text-primary-600"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Plus className="size-4" />
                                                    <span>Add New Template</span>
                                                </div>
                                            </SelectItem>
                                        </>
                                    ) : (
                                        <>
                                            <SelectItem value="no-templates" disabled>
                                                No templates available
                                            </SelectItem>
                                            <Separator className="my-1" />
                                            <SelectItem
                                                value="add-new-template"
                                                className="font-medium text-primary-600"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Plus className="size-4" />
                                                    <span>Add New Template</span>
                                                </div>
                                            </SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            {selectedTemplateId && selectedTemplateId !== 'add-new-template' && (
                                <div className="mt-2 text-xs text-neutral-600">
                                    Template selected:{' '}
                                    {emailTemplates.find((t) => t.id === selectedTemplateId)?.name}
                                </div>
                            )}
                            {templatesError && (
                                <div className="mt-2 text-xs text-red-600">{templatesError}</div>
                            )}
                        </div>
                    )}

                    {/* From Email selection */}
                    <div className="mb-4">
                        <Label className="mb-2 block text-sm font-medium">From Email</Label>
                        <Select
                            value={selectedFromEmail || ''}
                            onValueChange={(value) => {
                                if (value && value !== 'undefined') {
                                    setSelectedFromEmail(value);
                                }
                            }}
                            disabled={emailConfigsLoading}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue
                                    placeholder={
                                        emailConfigsLoading
                                            ? 'Loading email configurations...'
                                            : 'Select from email'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {emailConfigurations.length > 0 ? (
                                    emailConfigurations
                                        .filter((config) => config.email && config.name)
                                        .map((config, index) => {
                                            const uniqueValue = `${config.email} -${config.name} `;
                                            return (
                                                <SelectItem
                                                    key={`${config.email} -${index} `}
                                                    value={uniqueValue}
                                                >
                                                    {config.name} ({config.email})
                                                </SelectItem>
                                            );
                                        })
                                ) : (
                                    <SelectItem value="no-configs" disabled>
                                        No email configurations available
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {selectedFromEmail && (
                            <div className="mt-2 text-xs text-neutral-600">
                                From:{' '}
                                {
                                    emailConfigurations.find(
                                        (c) => `${c.email} -${c.name} ` === selectedFromEmail
                                    )?.email
                                }
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-neutral-600">
                        {useTemplate
                            ? 'Template content will be applied to Title and Content above.'
                            : 'Subject and body will use the Title and Content provided above.'}
                    </p>
                </section>

                <Separator />

                {/* Audience */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Audience</h3>
                    <p className="text-sm text-muted-foreground">
                        Define who should receive this email campaign.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addRecipientPreset('ALL_STUDENTS')}
                        >
                            + All Students
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addRecipientPreset('ALL_TEACHERS')}
                        >
                            + All Teachers
                        </Button>
                        <Button variant="outline" size="sm" onClick={addBatchRecipient}>
                            + {getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setRecipients((prev) => [
                                    ...prev,
                                    { recipientType: 'TAG', recipientId: '', recipientName: '' },
                                ])
                            }
                        >
                            + Tag
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setRecipients((prev) => [
                                    ...prev,
                                    { recipientType: 'USER', recipientId: '', recipientName: '' },
                                ])
                            }
                        >
                            + Specific User
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setRecipients((prev) => [
                                    ...prev,
                                    {
                                        recipientType: 'AUDIENCE',
                                        recipientId: '',
                                        recipientName: '',
                                    },
                                ])
                            }
                        >
                            + Campaign
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        {recipients.map((r, idx) => {
                            const hasRecipientId = r.recipientId && r.recipientId.trim() !== '';
                            const hasTagSelection =
                                r.recipientType === 'TAG' && (tagSelections[idx]?.length ?? 0) > 0;
                            const hasCustomFieldFilters =
                                r.recipientType === 'CUSTOM_FIELD_FILTER' &&
                                (customFieldFilters[idx]?.length ?? 0) > 0;
                            const hasAudienceId =
                                r.recipientType === 'AUDIENCE' &&
                                r.recipientId &&
                                r.recipientId.trim() !== '';
                            const showOptions =
                                hasRecipientId ||
                                hasTagSelection ||
                                hasCustomFieldFilters ||
                                hasAudienceId;

                            return (
                                <div key={idx} className="space-y-3">
                                    <div className="flex items-start gap-2">
                                        <Select
                                            value={r.recipientType}
                                            onValueChange={(v) => {
                                                setRecipients((prev) => {
                                                    const copy = [...prev];
                                                    copy[idx] = {
                                                        recipientType: v as
                                                            | 'ROLE'
                                                            | 'USER'
                                                            | 'PACKAGE_SESSION'
                                                            | 'PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES'
                                                            | 'TAG'
                                                            | 'AUDIENCE',
                                                        recipientId: '',
                                                        recipientName: '',
                                                    };
                                                    return copy;
                                                });
                                                // Clear custom field filters when switching types
                                                if (v !== 'CUSTOM_FIELD_FILTER') {
                                                    setCustomFieldFilters((prev) => {
                                                        const next = { ...prev };
                                                        delete next[idx];
                                                        return next;
                                                    });
                                                }
                                                // Clear exclusions when switching types
                                                setRecipientExclusions((prev) => {
                                                    const next = { ...prev };
                                                    delete next[idx];
                                                    return next;
                                                });
                                                // Clear batch role selections when switching types
                                                setBatchRoleSelections((prev) => {
                                                    const next = { ...prev };
                                                    delete next[idx];
                                                    return next;
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="w-40">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ROLE">Role</SelectItem>
                                                <SelectItem value="USER">User</SelectItem>
                                                <SelectItem value="PACKAGE_SESSION">
                                                    {getTerminology(
                                                        ContentTerms.Batch,
                                                        SystemTerms.Batch
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="TAG">Tag</SelectItem>
                                                <SelectItem value="AUDIENCE">Campaign</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {r.recipientType === 'ROLE' && (
                                            <Select
                                                value={r.recipientId}
                                                onValueChange={(v) => {
                                                    setRecipients((prev) =>
                                                        prev.map((item, i) =>
                                                            i === idx
                                                                ? {
                                                                      recipientType:
                                                                          'ROLE' as const,
                                                                      recipientId: v,
                                                                      recipientName: '',
                                                                  }
                                                                : item
                                                        )
                                                    );
                                                }}
                                            >
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder="Select role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="STUDENT">Student</SelectItem>
                                                    <SelectItem value="TEACHER">Teacher</SelectItem>
                                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {r.recipientType === 'USER' && (
                                            <Input
                                                placeholder="User ID or email"
                                                value={r.recipientId}
                                                onChange={(e) => {
                                                    setRecipients((prev) =>
                                                        prev.map((item, i) =>
                                                            i === idx
                                                                ? {
                                                                      recipientType:
                                                                          'USER' as const,
                                                                      recipientId: e.target.value,
                                                                      recipientName: '',
                                                                  }
                                                                : item
                                                        )
                                                    );
                                                }}
                                            />
                                        )}
                                        {r.recipientType === 'PACKAGE_SESSION' && (
                                            <div className="flex-1 space-y-2">
                                                <SearchableSelect
                                                    value={r.recipientId || ''}
                                                    onChange={(v) => {
                                                        const option = packageSessionOptions.find(
                                                            (opt) => opt.id === v
                                                        );
                                                        setRecipients((prev) =>
                                                            prev.map((item, i) =>
                                                                i === idx
                                                                    ? {
                                                                          recipientType:
                                                                              'PACKAGE_SESSION' as const,
                                                                          recipientId: v,
                                                                          recipientName:
                                                                              option?.label || '',
                                                                      }
                                                                    : item
                                                            )
                                                        );
                                                        // Clear role selection if batch is not sub-org
                                                        if (!option?.is_org_associated) {
                                                            setBatchRoleSelections((prev) => {
                                                                const next = { ...prev };
                                                                delete next[idx];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    options={packageSessionOptions
                                                        .filter(
                                                            (option) =>
                                                                option.id && option.id.trim() !== ''
                                                        )
                                                        .map((option) => ({
                                                            value: option.id,
                                                            label: option.label,
                                                        }))}
                                                    placeholder="Select batch"
                                                    searchPlaceholder="Search batches..."
                                                    emptyText="No batches found."
                                                />
                                                {r.recipientId &&
                                                    packageSessionOptions.find(
                                                        (opt) => opt.id === r.recipientId
                                                    )?.is_org_associated && (
                                                        <Select
                                                            value={batchRoleSelections[idx] || ''}
                                                            onValueChange={(v) => {
                                                                setBatchRoleSelections((prev) => ({
                                                                    ...prev,
                                                                    [idx]: v as 'ADMIN' | 'LEARNER',
                                                                }));
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Select role" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ADMIN">
                                                                    Admin
                                                                </SelectItem>
                                                                <SelectItem value="LEARNER">
                                                                    Learner
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                            </div>
                                        )}
                                        {r.recipientType === 'TAG' && (
                                            <div className="flex-1">
                                                <MultiSelect
                                                    options={tagOptions}
                                                    selected={tagSelections[idx] || []}
                                                    onChange={(vals) =>
                                                        setTagSelections((prev) => ({
                                                            ...prev,
                                                            [idx]: vals,
                                                        }))
                                                    }
                                                    placeholder={
                                                        tagsLoading
                                                            ? 'Loading tags…'
                                                            : 'Select one or more tags'
                                                    }
                                                    disabled={tagsLoading}
                                                />
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    Tags target users linked to the selected tags.
                                                </div>
                                                {Array.isArray(tagSelections[idx]) &&
                                                    (tagSelections[idx]?.length ?? 0) > 0 && (
                                                        <div className="mt-1 text-xs text-neutral-600">
                                                            Estimated users for this row:{' '}
                                                            {rowTagEstimates[idx] ?? '—'}
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                        {r.recipientType === 'AUDIENCE' && (
                                            <Select
                                                value={r.recipientId}
                                                onValueChange={(v) => {
                                                    const campaign = campaignOptions.find(
                                                        (opt) =>
                                                            opt.id === v || opt.campaign_id === v
                                                    );
                                                    setRecipients((prev) =>
                                                        prev.map((item, i) =>
                                                            i === idx
                                                                ? {
                                                                      recipientType:
                                                                          'AUDIENCE' as const,
                                                                      recipientId:
                                                                          campaign?.id ||
                                                                          campaign?.campaign_id ||
                                                                          v,
                                                                      recipientName:
                                                                          campaign?.campaign_name ||
                                                                          '',
                                                                  }
                                                                : item
                                                        )
                                                    );
                                                }}
                                            >
                                                <SelectTrigger className="w-96">
                                                    <SelectValue
                                                        placeholder={
                                                            campaignsLoading
                                                                ? 'Loading campaigns…'
                                                                : 'Select campaign'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {campaignOptions.length > 0 ? (
                                                        campaignOptions
                                                            .filter(
                                                                (campaign) =>
                                                                    (campaign.id ||
                                                                        campaign.campaign_id) &&
                                                                    (
                                                                        campaign.id ||
                                                                        campaign.campaign_id ||
                                                                        ''
                                                                    ).trim() !== ''
                                                            )
                                                            .map((campaign) => {
                                                                const campaignId =
                                                                    campaign.id ||
                                                                    campaign.campaign_id ||
                                                                    '';
                                                                return (
                                                                    <SelectItem
                                                                        key={campaignId}
                                                                        value={campaignId}
                                                                    >
                                                                        {campaign.campaign_name ||
                                                                            campaignId}
                                                                    </SelectItem>
                                                                );
                                                            })
                                                    ) : (
                                                        <SelectItem value="no-campaigns" disabled>
                                                            {campaignsLoading
                                                                ? 'Loading campaigns…'
                                                                : 'No campaigns available'}
                                                        </SelectItem>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        {r.recipientType === 'CUSTOM_FIELD_FILTER' && (
                                            <div className="flex-1 space-y-3">
                                                <div className="mb-2 text-xs text-muted-foreground">
                                                    Filter users based on custom field values. Add
                                                    multiple filters to narrow down the audience.
                                                </div>
                                                {(customFieldFilters[idx] || []).map(
                                                    (filter, filterIdx) => {
                                                        const selectedField =
                                                            customFieldOptions.find(
                                                                (f) => f.id === filter.fieldId
                                                            );
                                                        return (
                                                            <div
                                                                key={filterIdx}
                                                                className="space-y-2 rounded-md border p-3"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <div className="flex-1 space-y-2">
                                                                        <Select
                                                                            value={filter.fieldId}
                                                                            onValueChange={(
                                                                                fieldId
                                                                            ) => {
                                                                                const field =
                                                                                    customFieldOptions.find(
                                                                                        (f) =>
                                                                                            f.id ===
                                                                                            fieldId
                                                                                    );
                                                                                updateCustomFieldFilter(
                                                                                    idx,
                                                                                    filterIdx,
                                                                                    {
                                                                                        fieldId,
                                                                                        fieldName:
                                                                                            field?.name ||
                                                                                            '',
                                                                                        fieldType:
                                                                                            field?.type ||
                                                                                            'text',
                                                                                        filterValue:
                                                                                            field?.type ===
                                                                                            'dropdown'
                                                                                                ? []
                                                                                                : '',
                                                                                        operator:
                                                                                            field?.type ===
                                                                                            'text'
                                                                                                ? 'equals'
                                                                                                : undefined,
                                                                                    }
                                                                                );
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-full">
                                                                                <SelectValue placeholder="Select custom field" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {customFieldOptions
                                                                                    .filter(
                                                                                        (field) =>
                                                                                            field.id &&
                                                                                            field.id.trim() !==
                                                                                                ''
                                                                                    )
                                                                                    .map(
                                                                                        (field) => (
                                                                                            <SelectItem
                                                                                                key={
                                                                                                    field.id
                                                                                                }
                                                                                                value={
                                                                                                    field.id
                                                                                                }
                                                                                            >
                                                                                                {
                                                                                                    field.name
                                                                                                }{' '}
                                                                                                (
                                                                                                {
                                                                                                    field.type
                                                                                                }
                                                                                                )
                                                                                            </SelectItem>
                                                                                        )
                                                                                    )}
                                                                            </SelectContent>
                                                                        </Select>

                                                                        {selectedField &&
                                                                            selectedField.type ===
                                                                                'text' && (
                                                                                <div className="space-y-2">
                                                                                    <Select
                                                                                        value={
                                                                                            filter.operator ||
                                                                                            'equals'
                                                                                        }
                                                                                        onValueChange={(
                                                                                            op
                                                                                        ) =>
                                                                                            updateCustomFieldFilter(
                                                                                                idx,
                                                                                                filterIdx,
                                                                                                {
                                                                                                    operator:
                                                                                                        op as
                                                                                                            | 'equals'
                                                                                                            | 'contains'
                                                                                                            | 'starts_with'
                                                                                                            | 'ends_with',
                                                                                                }
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        <SelectTrigger className="w-full">
                                                                                            <SelectValue />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            <SelectItem value="equals">
                                                                                                Equals
                                                                                            </SelectItem>
                                                                                            <SelectItem value="contains">
                                                                                                Contains
                                                                                            </SelectItem>
                                                                                            <SelectItem value="starts_with">
                                                                                                Starts
                                                                                                with
                                                                                            </SelectItem>
                                                                                            <SelectItem value="ends_with">
                                                                                                Ends
                                                                                                with
                                                                                            </SelectItem>
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                    <Input
                                                                                        placeholder="Enter filter value"
                                                                                        value={
                                                                                            typeof filter.filterValue ===
                                                                                            'string'
                                                                                                ? filter.filterValue
                                                                                                : ''
                                                                                        }
                                                                                        onChange={(
                                                                                            e
                                                                                        ) =>
                                                                                            updateCustomFieldFilter(
                                                                                                idx,
                                                                                                filterIdx,
                                                                                                {
                                                                                                    filterValue:
                                                                                                        e
                                                                                                            .target
                                                                                                            .value,
                                                                                                }
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            )}

                                                                        {selectedField &&
                                                                            selectedField.type ===
                                                                                'dropdown' && (
                                                                                <MultiSelect
                                                                                    options={(
                                                                                        selectedField.options ||
                                                                                        []
                                                                                    ).map(
                                                                                        (opt) => ({
                                                                                            label: opt,
                                                                                            value: opt,
                                                                                        })
                                                                                    )}
                                                                                    selected={
                                                                                        Array.isArray(
                                                                                            filter.filterValue
                                                                                        )
                                                                                            ? filter.filterValue
                                                                                            : []
                                                                                    }
                                                                                    onChange={(
                                                                                        vals
                                                                                    ) =>
                                                                                        updateCustomFieldFilter(
                                                                                            idx,
                                                                                            filterIdx,
                                                                                            {
                                                                                                filterValue:
                                                                                                    vals,
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                    placeholder="Select values"
                                                                                />
                                                                            )}

                                                                        {selectedField &&
                                                                            selectedField.type ===
                                                                                'number' && (
                                                                                <Input
                                                                                    type="number"
                                                                                    placeholder="Enter number"
                                                                                    value={
                                                                                        typeof filter.filterValue ===
                                                                                        'string'
                                                                                            ? filter.filterValue
                                                                                            : ''
                                                                                    }
                                                                                    onChange={(e) =>
                                                                                        updateCustomFieldFilter(
                                                                                            idx,
                                                                                            filterIdx,
                                                                                            {
                                                                                                filterValue:
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                            }
                                                                                        )
                                                                                    }
                                                                                />
                                                                            )}
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            removeCustomFieldFilter(
                                                                                idx,
                                                                                filterIdx
                                                                            )
                                                                        }
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => addCustomFieldFilter(idx)}
                                                    className="w-full"
                                                >
                                                    + Add Filter
                                                </Button>
                                            </div>
                                        )}
                                        <Button
                                            variant="ghost"
                                            onClick={() => removeRecipientAtIndex(idx)}
                                        >
                                            Remove
                                        </Button>
                                    </div>

                                    {/* Exclusions and Custom Fields - shown after selecting recipient type and ID */}
                                    {showOptions && (
                                        <div className="ml-0 space-y-3 rounded-md border p-3">
                                            {/* Exclusions Section */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium">
                                                        Exclusions
                                                    </label>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => addExclusion(idx)}
                                                    >
                                                        + Add Exclusion
                                                    </Button>
                                                </div>
                                                {(recipientExclusions[idx] || []).length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">
                                                        No exclusions added yet
                                                    </p>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {(recipientExclusions[idx] || []).map(
                                                            (exclusion) => (
                                                                <div
                                                                    key={exclusion.id}
                                                                    className="flex items-center gap-2 rounded-md border p-2"
                                                                >
                                                                    <Select
                                                                        value={
                                                                            exclusion.recipientType
                                                                        }
                                                                        onValueChange={(value) =>
                                                                            updateExclusion(
                                                                                idx,
                                                                                exclusion.id,
                                                                                'recipientType',
                                                                                value
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger className="w-32">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="ROLE">
                                                                                Role
                                                                            </SelectItem>
                                                                            <SelectItem value="USER">
                                                                                User
                                                                            </SelectItem>
                                                                            <SelectItem value="PACKAGE_SESSION">
                                                                                {getTerminology(
                                                                                    ContentTerms.Batch,
                                                                                    SystemTerms.Batch
                                                                                )}
                                                                            </SelectItem>
                                                                            <SelectItem value="TAG">
                                                                                Tag
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>

                                                                    {exclusion.recipientType ===
                                                                    'ROLE' ? (
                                                                        <Select
                                                                            value={
                                                                                exclusion.recipientId
                                                                            }
                                                                            onValueChange={(
                                                                                value
                                                                            ) => {
                                                                                updateExclusion(
                                                                                    idx,
                                                                                    exclusion.id,
                                                                                    'recipientId',
                                                                                    value
                                                                                );
                                                                                updateExclusion(
                                                                                    idx,
                                                                                    exclusion.id,
                                                                                    'recipientName',
                                                                                    value
                                                                                );
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-32">
                                                                                <SelectValue placeholder="Select role" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="STUDENT">
                                                                                    Student
                                                                                </SelectItem>
                                                                                <SelectItem value="TEACHER">
                                                                                    Teacher
                                                                                </SelectItem>
                                                                                <SelectItem value="ADMIN">
                                                                                    Admin
                                                                                </SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : exclusion.recipientType ===
                                                                      'PACKAGE_SESSION' ? (
                                                                        <SearchableSelect
                                                                            value={
                                                                                exclusion.recipientId
                                                                            }
                                                                            onChange={(value) => {
                                                                                const option =
                                                                                    packageSessionOptions.find(
                                                                                        (opt) =>
                                                                                            opt.id ===
                                                                                            value
                                                                                    );
                                                                                updateExclusion(
                                                                                    idx,
                                                                                    exclusion.id,
                                                                                    'recipientId',
                                                                                    value
                                                                                );
                                                                                if (option) {
                                                                                    updateExclusion(
                                                                                        idx,
                                                                                        exclusion.id,
                                                                                        'recipientName',
                                                                                        option.label
                                                                                    );
                                                                                }
                                                                            }}
                                                                            options={packageSessionOptions
                                                                                .filter(
                                                                                    (option) =>
                                                                                        option.id &&
                                                                                        option.id.trim() !==
                                                                                            ''
                                                                                )
                                                                                .map((option) => ({
                                                                                    value: option.id,
                                                                                    label: option.label,
                                                                                }))}
                                                                            placeholder="Select batch"
                                                                            searchPlaceholder="Search batches..."
                                                                            emptyText="No batches found."
                                                                            triggerClassName="w-48"
                                                                        />
                                                                    ) : exclusion.recipientType ===
                                                                      'TAG' ? (
                                                                        <Select
                                                                            value={
                                                                                exclusion.recipientId
                                                                            }
                                                                            onValueChange={(
                                                                                value
                                                                            ) => {
                                                                                const tag =
                                                                                    tagMapById[
                                                                                        value
                                                                                    ];
                                                                                updateExclusion(
                                                                                    idx,
                                                                                    exclusion.id,
                                                                                    'recipientId',
                                                                                    value
                                                                                );
                                                                                if (tag) {
                                                                                    updateExclusion(
                                                                                        idx,
                                                                                        exclusion.id,
                                                                                        'recipientName',
                                                                                        tag.tagName
                                                                                    );
                                                                                }
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="w-48">
                                                                                <SelectValue placeholder="Select tag" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {tagOptions
                                                                                    .filter(
                                                                                        (option) =>
                                                                                            option.value &&
                                                                                            option.value.trim() !==
                                                                                                ''
                                                                                    )
                                                                                    .map(
                                                                                        (
                                                                                            option
                                                                                        ) => (
                                                                                            <SelectItem
                                                                                                key={
                                                                                                    option.value
                                                                                                }
                                                                                                value={
                                                                                                    option.value
                                                                                                }
                                                                                            >
                                                                                                {
                                                                                                    option.label
                                                                                                }
                                                                                            </SelectItem>
                                                                                        )
                                                                                    )}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    ) : (
                                                                        <Input
                                                                            placeholder="User ID or email"
                                                                            value={
                                                                                exclusion.recipientId
                                                                            }
                                                                            onChange={(e) =>
                                                                                updateExclusion(
                                                                                    idx,
                                                                                    exclusion.id,
                                                                                    'recipientId',
                                                                                    e.target.value
                                                                                )
                                                                            }
                                                                            className="w-48"
                                                                        />
                                                                    )}

                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            removeExclusion(
                                                                                idx,
                                                                                exclusion.id
                                                                            )
                                                                        }
                                                                        className="text-red-600 hover:text-red-700"
                                                                    >
                                                                        ×
                                                                    </Button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Custom Fields Section - only show for non-CUSTOM_FIELD_FILTER types */}
                                            {customFieldOptions.length > 0 &&
                                                r.recipientType !== 'CUSTOM_FIELD_FILTER' && (
                                                    <div className="space-y-2 border-t pt-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-sm font-medium">
                                                                Custom Field Filters
                                                            </label>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    addCustomFieldFilter(idx)
                                                                }
                                                            >
                                                                + Add Custom Field
                                                            </Button>
                                                        </div>
                                                        {(customFieldFilters[idx] || []).length ===
                                                        0 ? (
                                                            <p className="text-xs text-muted-foreground">
                                                                No custom field filters added yet
                                                            </p>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {(
                                                                    customFieldFilters[idx] || []
                                                                ).map((filter, filterIdx) => {
                                                                    const selectedField =
                                                                        customFieldOptions.find(
                                                                            (f) =>
                                                                                f.id ===
                                                                                filter.fieldId
                                                                        );
                                                                    return (
                                                                        <div
                                                                            key={filterIdx}
                                                                            className="space-y-2 rounded-md border p-2"
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                <div className="flex-1 space-y-2">
                                                                                    <Select
                                                                                        value={
                                                                                            filter.fieldId
                                                                                        }
                                                                                        onValueChange={(
                                                                                            fieldId
                                                                                        ) => {
                                                                                            const field =
                                                                                                customFieldOptions.find(
                                                                                                    (
                                                                                                        f
                                                                                                    ) =>
                                                                                                        f.id ===
                                                                                                        fieldId
                                                                                                );
                                                                                            updateCustomFieldFilter(
                                                                                                idx,
                                                                                                filterIdx,
                                                                                                {
                                                                                                    fieldId,
                                                                                                    fieldName:
                                                                                                        field?.name ||
                                                                                                        '',
                                                                                                    fieldType:
                                                                                                        field?.type ||
                                                                                                        'text',
                                                                                                    filterValue:
                                                                                                        field?.type ===
                                                                                                        'dropdown'
                                                                                                            ? []
                                                                                                            : '',
                                                                                                    operator:
                                                                                                        field?.type ===
                                                                                                        'text'
                                                                                                            ? 'equals'
                                                                                                            : undefined,
                                                                                                }
                                                                                            );
                                                                                        }}
                                                                                    >
                                                                                        <SelectTrigger className="w-full">
                                                                                            <SelectValue placeholder="Select custom field" />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {customFieldOptions
                                                                                                .filter(
                                                                                                    (
                                                                                                        field
                                                                                                    ) =>
                                                                                                        field.id &&
                                                                                                        field.id.trim() !==
                                                                                                            ''
                                                                                                )
                                                                                                .map(
                                                                                                    (
                                                                                                        field
                                                                                                    ) => (
                                                                                                        <SelectItem
                                                                                                            key={
                                                                                                                field.id
                                                                                                            }
                                                                                                            value={
                                                                                                                field.id
                                                                                                            }
                                                                                                        >
                                                                                                            {
                                                                                                                field.name
                                                                                                            }{' '}
                                                                                                            (
                                                                                                            {
                                                                                                                field.type
                                                                                                            }

                                                                                                            )
                                                                                                        </SelectItem>
                                                                                                    )
                                                                                                )}
                                                                                        </SelectContent>
                                                                                    </Select>

                                                                                    {selectedField &&
                                                                                        selectedField.type ===
                                                                                            'text' && (
                                                                                            <div className="space-y-2">
                                                                                                <Select
                                                                                                    value={
                                                                                                        filter.operator ||
                                                                                                        'equals'
                                                                                                    }
                                                                                                    onValueChange={(
                                                                                                        op
                                                                                                    ) =>
                                                                                                        updateCustomFieldFilter(
                                                                                                            idx,
                                                                                                            filterIdx,
                                                                                                            {
                                                                                                                operator:
                                                                                                                    op as
                                                                                                                        | 'equals'
                                                                                                                        | 'contains'
                                                                                                                        | 'starts_with'
                                                                                                                        | 'ends_with',
                                                                                                            }
                                                                                                        )
                                                                                                    }
                                                                                                >
                                                                                                    <SelectTrigger className="w-full">
                                                                                                        <SelectValue />
                                                                                                    </SelectTrigger>
                                                                                                    <SelectContent>
                                                                                                        <SelectItem value="equals">
                                                                                                            Equals
                                                                                                        </SelectItem>
                                                                                                        <SelectItem value="contains">
                                                                                                            Contains
                                                                                                        </SelectItem>
                                                                                                        <SelectItem value="starts_with">
                                                                                                            Starts
                                                                                                            with
                                                                                                        </SelectItem>
                                                                                                        <SelectItem value="ends_with">
                                                                                                            Ends
                                                                                                            with
                                                                                                        </SelectItem>
                                                                                                    </SelectContent>
                                                                                                </Select>
                                                                                                <Input
                                                                                                    placeholder="Enter filter value"
                                                                                                    value={
                                                                                                        typeof filter.filterValue ===
                                                                                                        'string'
                                                                                                            ? filter.filterValue
                                                                                                            : ''
                                                                                                    }
                                                                                                    onChange={(
                                                                                                        e
                                                                                                    ) =>
                                                                                                        updateCustomFieldFilter(
                                                                                                            idx,
                                                                                                            filterIdx,
                                                                                                            {
                                                                                                                filterValue:
                                                                                                                    e
                                                                                                                        .target
                                                                                                                        .value,
                                                                                                            }
                                                                                                        )
                                                                                                    }
                                                                                                />
                                                                                            </div>
                                                                                        )}

                                                                                    {selectedField &&
                                                                                        selectedField.type ===
                                                                                            'dropdown' && (
                                                                                            <MultiSelect
                                                                                                options={(
                                                                                                    selectedField.options ||
                                                                                                    []
                                                                                                ).map(
                                                                                                    (
                                                                                                        opt
                                                                                                    ) => ({
                                                                                                        label: opt,
                                                                                                        value: opt,
                                                                                                    })
                                                                                                )}
                                                                                                selected={
                                                                                                    Array.isArray(
                                                                                                        filter.filterValue
                                                                                                    )
                                                                                                        ? filter.filterValue
                                                                                                        : []
                                                                                                }
                                                                                                onChange={(
                                                                                                    vals
                                                                                                ) =>
                                                                                                    updateCustomFieldFilter(
                                                                                                        idx,
                                                                                                        filterIdx,
                                                                                                        {
                                                                                                            filterValue:
                                                                                                                vals,
                                                                                                        }
                                                                                                    )
                                                                                                }
                                                                                                placeholder="Select values"
                                                                                            />
                                                                                        )}

                                                                                    {selectedField &&
                                                                                        selectedField.type ===
                                                                                            'number' && (
                                                                                            <Input
                                                                                                type="number"
                                                                                                placeholder="Enter number"
                                                                                                value={
                                                                                                    typeof filter.filterValue ===
                                                                                                    'string'
                                                                                                        ? filter.filterValue
                                                                                                        : ''
                                                                                                }
                                                                                                onChange={(
                                                                                                    e
                                                                                                ) =>
                                                                                                    updateCustomFieldFilter(
                                                                                                        idx,
                                                                                                        filterIdx,
                                                                                                        {
                                                                                                            filterValue:
                                                                                                                e
                                                                                                                    .target
                                                                                                                    .value,
                                                                                                        }
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        )}
                                                                                </div>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        removeCustomFieldFilter(
                                                                                            idx,
                                                                                            filterIdx
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    ×
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Recipient chips summary */}
                    {recipients.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs">
                            {recipients.map((r, idx) => {
                                if (r.recipientType === 'TAG') {
                                    const ids = tagSelections[idx] || [];
                                    return ids.map((id) => {
                                        const tag = tagMapById[id];
                                        return (
                                            <span
                                                key={`${idx} -${id} `}
                                                className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5"
                                            >
                                                <span className="font-medium">TAG</span>
                                                <span className="text-neutral-600">
                                                    {tag?.tagName || id}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-neutral-500 hover:text-neutral-800"
                                                    onClick={() => {
                                                        setTagSelections((prev) => {
                                                            const next = { ...prev };
                                                            next[idx] = (next[idx] || []).filter(
                                                                (x) => x !== id
                                                            );
                                                            return next;
                                                        });
                                                    }}
                                                    aria-label="Remove tag"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        );
                                    });
                                }
                                return (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5"
                                    >
                                        <span className="font-medium">
                                            {r.recipientType === 'PACKAGE_SESSION'
                                                ? getTerminology(
                                                      ContentTerms.Batch,
                                                      SystemTerms.Batch
                                                  )
                                                : r.recipientType}
                                        </span>
                                        <span className="text-neutral-600">
                                            {r.recipientType === 'PACKAGE_SESSION'
                                                ? packageSessionOptions.find(
                                                      (opt) => opt.id === r.recipientId
                                                  )?.label ||
                                                  r.recipientId ||
                                                  '—'
                                                : r.recipientId || r.recipientName || '—'}
                                        </span>
                                        <button
                                            type="button"
                                            className="text-neutral-500 hover:text-neutral-800"
                                            onClick={() => removeRecipientAtIndex(idx)}
                                            aria-label="Remove recipient"
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Estimated users */}
                    {Object.values(tagSelections).flat().length > 0 && (
                        <div className="text-xs text-neutral-600">
                            {estimatingUsers
                                ? 'Estimating users…'
                                : `Estimated users(any of selected tags): ${estimatedUsers ?? '—'} `}
                        </div>
                    )}
                </section>

                <Separator />

                {/* Mode Settings - Fixed to SYSTEM_ALERT */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Campaign Settings</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure the priority and expiration for this email campaign.
                    </p>
                    <div className="rounded-md border p-4">
                        <div className="mb-2 font-medium">Priority & Expiration</div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <Label>Priority</Label>
                                <Select
                                    value={
                                        (modeSettings.SYSTEM_ALERT?.priority as string) || 'MEDIUM'
                                    }
                                    onValueChange={(v) =>
                                        setModeSettings((prev) => ({
                                            ...prev,
                                            SYSTEM_ALERT: { ...prev.SYSTEM_ALERT, priority: v },
                                        }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="HIGH">HIGH</SelectItem>
                                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                                        <SelectItem value="LOW">LOW</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors['modes.SYSTEM_ALERT.priority'] && (
                                    <p className="text-xs text-red-600">
                                        {errors['modes.SYSTEM_ALERT.priority']}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Expires At (Optional)</Label>
                                <Input
                                    type="datetime-local"
                                    value={(modeSettings.SYSTEM_ALERT?.expiresAt as string) || ''}
                                    onChange={(e) =>
                                        setModeSettings((prev) => ({
                                            ...prev,
                                            SYSTEM_ALERT: {
                                                ...prev.SYSTEM_ALERT,
                                                expiresAt: e.target.value,
                                            },
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <Separator />

                {/* Scheduling */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Scheduling</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Select
                            value={scheduleType}
                            onValueChange={(v) =>
                                setScheduleType(v as 'IMMEDIATE' | 'ONE_TIME' | 'RECURRING')
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Schedule Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="IMMEDIATE">IMMEDIATE</SelectItem>
                                <SelectItem value="ONE_TIME">ONE_TIME</SelectItem>
                                <SelectItem value="RECURRING">RECURRING</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={timezone} onValueChange={(v) => setTimezone(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONE_OPTIONS.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-neutral-600">Quick picks:</span>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('NOW')}
                            >
                                Now
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('IN_1H')}
                            >
                                +1h
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('TOMORROW_9AM')}
                            >
                                Tmrw 9AM
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('NEXT_MON_9AM')}
                            >
                                Mon 9AM
                            </Button>
                        </div>
                    </div>
                    {scheduleType === 'ONE_TIME' && (
                        <div className="grid gap-2">
                            <Label>Run At</Label>
                            <Input
                                type="datetime-local"
                                value={oneTimeStart}
                                onChange={(e) => setOneTimeStart(e.target.value)}
                                className={errors['schedule.startDate'] ? 'border-red-500' : ''}
                            />
                            {errors['schedule.startDate'] && (
                                <p className="text-xs text-red-600">
                                    {errors['schedule.startDate']}
                                </p>
                            )}
                        </div>
                    )}
                    {scheduleType === 'RECURRING' && (
                        <div className="grid gap-2">
                            <Label>Cron Expression</Label>
                            <Input
                                placeholder="0 0 9 * * ?"
                                value={cronExpression}
                                onChange={(e) => setCronExpression(e.target.value)}
                                className={
                                    errors['schedule.cronExpression'] ? 'border-red-500' : ''
                                }
                            />
                            {errors['schedule.cronExpression'] && (
                                <p className="text-xs text-red-600">
                                    {errors['schedule.cronExpression']}
                                </p>
                            )}
                            <div className="flex gap-2 text-xs">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyCronTemplate('DAILY_9')}
                                >
                                    Daily 9AM
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyCronTemplate('MON_9')}
                                >
                                    Monday 9AM
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyCronTemplate('HOURLY')}
                                >
                                    Hourly
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Submit */}
                <div className="flex gap-2">
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Sending…' : 'Send Email Campaign'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsReviewOpen(true)}
                        disabled={isSubmitting}
                    >
                        Review and Send
                    </Button>
                </div>
            </div>
        </div>
    );
}
