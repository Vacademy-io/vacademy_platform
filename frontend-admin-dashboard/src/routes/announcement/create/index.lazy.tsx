import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
    AnnouncementService,
    InstituteAnnouncementSettingsService,
    type CreateAnnouncementRequest,
    type ModeType,
    type MediumType,
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
import { Switch } from '@/components/ui/switch';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';
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
import {
    Smartphone,
    Tablet,
    Laptop,
    Bell,
    Pin,
    MessageSquare,
    Megaphone,
    Folder,
    Users,
    ClipboardList,
    Plus,
    type LucideIcon,
} from 'lucide-react';
import { MultiSelect, type OptionType } from '@/components/design-system/multi-select';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { TIMEZONE_OPTIONS } from '@/routes/study-library/live-session/schedule/-constants/options';
import { getInstituteTags, getUserCountsByTags, type TagItem } from '@/services/tag-management';
import { getInstituteId } from '@/constants/helper';
import { getMessageTemplates, getMessageTemplate } from '@/services/message-template-service';
import type { MessageTemplate } from '@/types/message-template-types';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
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

export const Route = createLazyFileRoute('/announcement/create/')({
    component: () => (
        <LayoutContainer>
            <CreateAnnouncementPage />
        </LayoutContainer>
    ),
});

function CreateAnnouncementPage() {
    const { setNavHeading } = useNavHeadingStore();
    const { toast } = useToast();
    const navigate = useNavigate();

    // Institute details for package sessions
    const instituteQuery = useInstituteQuery();
    const { instituteDetails, getPackageWiseLevels, getDetailsFromPackageSessionId } =
        useInstituteDetailsStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Minimal starter state; real UI will dynamically build this
    const [title, setTitle] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [contentView, setContentView] = useState<'editor' | 'source'>('editor');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'laptop'>('laptop');
    const DEVICE_PRESETS: Record<typeof previewDevice, { label: string; width: number }> = {
        mobile: { label: 'Mobile', width: 390 }, // iPhone 14 width
        tablet: { label: 'Tablet', width: 768 }, // iPad portrait
        laptop: { label: 'Laptop', width: 1280 }, // common laptop width
    };
    const isFullHtmlDoc = useMemo(() => {
        const s = htmlContent || '';
        return (
            /<html[\s\S]*<\/html>/i.test(s) ||
            /<head[\s\S]*<\/head>/i.test(s) ||
            /<body[\s\S]*<\/body>/i.test(s)
        );
    }, [htmlContent]);
    const [selectedModes, setSelectedModes] = useState<ModeType[]>([]);
    const [modeSettings, setModeSettings] = useState<Record<ModeType, Record<string, unknown>>>(
        {} as Record<ModeType, Record<string, unknown>>
    );
    const [selectedMediums, setSelectedMediums] = useState<MediumType[]>(['PUSH_NOTIFICATION']);
    const [mediumConfigs, setMediumConfigs] = useState<Record<MediumType, Record<string, unknown>>>(
        {
            PUSH_NOTIFICATION: { title: '', body: '' },
            EMAIL: { subject: '', body: '' },
            WHATSAPP: { template: '', variables: {} },
        }
    );
    const [syncPushFromTitleContent, setSyncPushFromTitleContent] = useState<boolean>(true);
    const [recipients, setRecipients] = useState<CreateAnnouncementRequest['recipients']>([]);
    // For TAG recipient rows, hold selected tagIds by row index
    const [tagSelections, setTagSelections] = useState<Record<number, string[]>>({});
    const [tagFilterByRow, setTagFilterByRow] = useState<
        Record<number, 'ALL' | 'DEFAULT' | 'INSTITUTE'>
    >({});
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
        'announcement_timezone',
        defaultTz
    );
    const [timezone, setTimezone] = useState<string>(getSavedTz());
    const [oneTimeStart, setOneTimeStart] = useState<string>('');
    const [oneTimeEnd] = useState<string>('');
    const [cronExpression, setCronExpression] = useState<string>('');
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
    // placeholder for future autocomplete; keep local dialog input state instead

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
    const [selectedPackageSessionId, setSelectedPackageSessionId] = useState<string>('');
    const [packageSessionOptions, setPackageSessionOptions] = useState<
        Array<{
            id: string;
            label: string;
            packageName: string;
            levelName: string;
            sessionName: string;
            is_org_associated?: boolean;
        }>
    >([]);

    // Track selected role for sub-org batches (Admin or Learner)
    const [batchRoleSelections, setBatchRoleSelections] = useState<
        Record<number, 'ADMIN' | 'LEARNER'>
    >({});

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

    // Campaign options state
    const [campaignOptions, setCampaignOptions] = useState<CampaignItem[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);

    // Permissions
    const [allowedModes, setAllowedModes] = useState<Record<ModeType, boolean>>(
        {} as Record<ModeType, boolean>
    );
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const userRoles = useMemo(() => getUserRoles(accessToken), [accessToken]);
    const primaryRole = userRoles?.[0] ?? 'TEACHER';

    useEffect(() => {
        setNavHeading('Create Announcement');
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

                    // Add fixed fields
                    settings.fixedFields.forEach((field: FixedField) => {
                        allFields.push({
                            id: field.id,
                            name: field.name,
                            type: 'text',
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

    // Load email templates only when needed
    const loadEmailTemplates = async () => {
        if (emailTemplates.length > 0 || templatesLoading) return; // Already loaded or loading

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

                // Always set a default email when configurations are loaded
                if (configs.length > 0) {
                    // Check if the persisted email is still valid
                    const persistedEmail =
                        typeof window !== 'undefined'
                            ? localStorage.getItem('selectedFromEmail')
                            : null;

                    if (
                        persistedEmail &&
                        configs.find((c) => `${c.email}-${c.name}` === persistedEmail)
                    ) {
                        setSelectedFromEmail(persistedEmail);
                    } else {
                        const defaultValue = `${configs[0]?.email}-${configs[0]?.name}`;
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
    }, []); // Only run once on mount

    // Persist selectedFromEmail to localStorage
    useEffect(() => {
        if (selectedFromEmail && typeof window !== 'undefined') {
            localStorage.setItem('selectedFromEmail', selectedFromEmail);
        }
    }, [selectedFromEmail]);

    // Load package session options when institute details are available
    useEffect(() => {
        if (instituteDetails?.batches_for_sessions) {
            const options = instituteDetails.batches_for_sessions.map((batch) => ({
                id: batch.id,
                label: `${batch.package_dto.package_name} - ${batch.level.level_name} - ${batch.session.session_name}`,
                packageName: batch.package_dto.package_name,
                levelName: batch.level.level_name,
                sessionName: batch.session.session_name,
                is_org_associated: (batch as any).is_org_associated || false,
            }));
            setPackageSessionOptions(options);
        }
    }, [instituteDetails]);

    // Optional UX: estimate users for selected tags (ANY-of semantics)
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

    // Per-row tag estimates
    useEffect(() => {
        const entries = Object.entries(tagSelections);
        if (entries.length === 0) {
            setRowTagEstimates({});
            return;
        }
        let cancelled = false;
        (async () => {
            const results: Record<number, number | null> = {};
            await Promise.all(
                entries.map(async ([idxStr, ids]) => {
                    const idx = Number(idxStr);
                    if (!ids || ids.length === 0) {
                        results[idx] = null;
                        return;
                    }
                    try {
                        const res = await getUserCountsByTags(ids);
                        results[idx] = res?.totalUsers ?? null;
                    } catch {
                        results[idx] = null;
                    }
                })
            );
            if (!cancelled) setRowTagEstimates(results);
        })();
        return () => {
            cancelled = true;
        };
    }, [tagSelections]);

    // Prefill from schedule page (query: scheduleType, startDate)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const sp = new URLSearchParams(window.location.search);
            const st = sp.get('scheduleType');
            const sd = sp.get('startDate');
            if (st === 'ONE_TIME') {
                setScheduleType('ONE_TIME');
                if (sd) {
                    // Convert ISO to input datetime-local format (YYYY-MM-DDTHH:mm)
                    const dt = new Date(sd);
                    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16);
                    setOneTimeStart(local);
                }
            }
        } catch {
            /* no-op */
        }
    }, []);

    // Persist timezone whenever it changes
    useEffect(() => {
        if (timezone) setSavedTz(timezone);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timezone]);

    useEffect(() => {
        // Check institute permissions for each mode
        const allModes: ModeType[] = [
            'SYSTEM_ALERT',
            'DASHBOARD_PIN',
            'DM',
            'STREAM',
            'RESOURCES',
            'COMMUNITY',
            'TASKS',
        ];
        (async () => {
            try {
                // Ensure settings exist (optional fetch)
                await InstituteAnnouncementSettingsService.get().catch(() => undefined);
                const results = await Promise.all(
                    allModes.map(async (mode) => {
                        try {
                            const res: { allowed?: boolean } =
                                await InstituteAnnouncementSettingsService.checkPermissions({
                                    userRole: primaryRole,
                                    action: 'send',
                                    modeType: mode,
                                });
                            return { mode, allowed: res?.allowed ?? true };
                        } catch (e) {
                            // If API not available for a specific mode, default allow
                            return { mode, allowed: true };
                        }
                    })
                );
                const map = results.reduce(
                    (acc, r) => {
                        acc[r.mode] = r.allowed;
                        return acc;
                    },
                    {} as Record<ModeType, boolean>
                );
                setAllowedModes(map);
            } finally {
                setLoadingPermissions(false);
            }
        })();
    }, [primaryRole]);

    // Utility: extract plain text from HTML for previews/notifications
    const extractTextFromHtml = (html: string): string => {
        try {
            const withoutTags = (html || '').replace(/<[^>]*>/g, ' ');
            return withoutTags.replace(/\s+/g, ' ').trim();
        } catch {
            return html;
        }
    };

    // Auto-populate Push Notification title/body from Title & Content
    useEffect(() => {
        if (!syncPushFromTitleContent) return;
        setMediumConfigs((prev) => ({
            ...prev,
            PUSH_NOTIFICATION: {
                ...prev.PUSH_NOTIFICATION,
                title: title,
                body: extractTextFromHtml(htmlContent).slice(0, 200),
            },
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, htmlContent, syncPushFromTitleContent]);

    // Derived UI helpers
    const pushTitleLen = ((mediumConfigs.PUSH_NOTIFICATION?.title as string) || '').length;
    const pushBodyLen = ((mediumConfigs.PUSH_NOTIFICATION?.body as string) || '').length;

    const reviewRecipientItems = useMemo(() => {
        const items: Array<{ type: string; text: string }> = [];
        recipients.forEach((r, idx) => {
            if (r.recipientType === 'TAG') {
                const ids = tagSelections[idx] || [];
                ids.forEach((id) => {
                    const tag = tagMapById[id];
                    items.push({ type: 'TAG', text: tag?.tagName || id });
                });
            } else if (r.recipientType === 'CUSTOM_FIELD_FILTER') {
                const filters = customFieldFilters[idx] || [];
                const filterText = filters
                    .filter((f) => f.fieldId && f.filterValue)
                    .map(
                        (f) =>
                            `${f.fieldName}: ${Array.isArray(f.filterValue) ? f.filterValue.join(', ') : f.filterValue}`
                    )
                    .join('; ');
                items.push({ type: 'CUSTOM_FIELD_FILTER', text: filterText || '—' });
            } else {
                items.push({
                    type: r.recipientType,
                    text: r.recipientId || r.recipientName || '—',
                });
            }
        });
        return items;
    }, [recipients, tagSelections, tagMapById, customFieldFilters]);

    const dateToLocalInput = (dt: Date) => {
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        return local;
    };

    const applyModePreset = (preset: 'GENERAL' | 'PINNED') => {
        if (preset === 'GENERAL') {
            setSelectedModes((prev) =>
                prev.includes('SYSTEM_ALERT') ? prev : [...prev, 'SYSTEM_ALERT']
            );
            setModeSettings((prev) => ({
                ...prev,
                SYSTEM_ALERT: prev.SYSTEM_ALERT ?? defaultModeSettings('SYSTEM_ALERT'),
            }));
            setSelectedMediums((prev) => {
                return Array.from(new Set([...prev, 'PUSH_NOTIFICATION', 'EMAIL'])) as MediumType[];
            });
        } else {
            setSelectedModes((prev) =>
                prev.includes('DASHBOARD_PIN') ? prev : [...prev, 'DASHBOARD_PIN']
            );
            setModeSettings((prev) => ({
                ...prev,
                DASHBOARD_PIN: prev.DASHBOARD_PIN ?? defaultModeSettings('DASHBOARD_PIN'),
            }));
            setSelectedMediums((prev) => {
                return Array.from(new Set([...prev, 'PUSH_NOTIFICATION'])) as MediumType[];
            });
        }
    };

    const applyScheduleQuickPick = (
        pick: 'NOW' | 'TODAY_5PM' | 'TOMORROW_9AM' | 'NEXT_MON_9AM'
    ) => {
        const now = new Date();
        if (pick === 'NOW') {
            setScheduleType('IMMEDIATE');
            return;
        }
        const target = new Date(now);
        if (pick === 'TODAY_5PM') {
            target.setHours(17, 0, 0, 0);
            if (target < now) target.setDate(target.getDate() + 1);
        } else if (pick === 'TOMORROW_9AM') {
            target.setDate(target.getDate() + 1);
            target.setHours(9, 0, 0, 0);
        } else if (pick === 'NEXT_MON_9AM') {
            const day = target.getDay();
            const delta = (8 - day) % 7 || 7; // days until next Monday
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

    const handleTemplateSelection = async (templateId: string) => {
        try {
            // Fetch full template content from API
            const fullTemplate = await getMessageTemplate(templateId);
            setSelectedTemplateId(templateId);
            // Apply template content to title and content
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
            const template = emailTemplates.find(t => t.id === templateId);
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
        // Get the first available package session as default
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
            // If no batches available, add empty package session row
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

    // Exclusion functions
    const addExclusion = (recipientIdx: number) => {
        setRecipientExclusions((prev) => {
            const current = prev[recipientIdx] || [];
            return {
                ...prev,
                [recipientIdx]: [
                    ...current,
                    {
                        id: `exclusion-${Date.now()}-${recipientIdx}`,
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
        setTagFilterByRow((prev) => {
            const next = { ...prev };
            delete next[idx];
            return next;
        });
        setCustomFieldFilters((prev) => {
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

    return (
        <div className="p-4">
            {/* TODO: Build dynamic UI based on institute + notification settings */}
            <h2 className="text-xl font-semibold">Create Announcement</h2>
            <div className="mt-6 grid max-w-3xl gap-8">
                {/* Review Dialog */}
                <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Review Announcement</DialogTitle>
                            <DialogDescription>Confirm details before creating.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                            <div>
                                <div className="text-sm font-medium">Title</div>
                                <div className="text-sm text-neutral-700">{title || '—'}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Modes</div>
                                <div className="text-sm text-neutral-700">
                                    {selectedModes.join(', ') || '—'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium">Mediums</div>
                                <div className="text-sm text-neutral-700">
                                    {selectedMediums.join(', ') || '—'}
                                </div>
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
                                    {scheduleType === 'IMMEDIATE' && `IMMEDIATE (${timezone})`}
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
                                    // Trigger main create button click by simulating same handler
                                    const el = document.querySelector(
                                        'button:contains("Create Announcement")'
                                    ) as HTMLButtonElement | null;
                                    el?.click();
                                }}
                                disabled={isSubmitting}
                            >
                                Confirm & Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <BatchDialog
                    open={isBatchDialogOpen}
                    onOpenChange={(v) => setIsBatchDialogOpen(v)}
                    onConfirm={(id) =>
                        setRecipients((prev) => [
                            ...prev,
                            {
                                recipientType: 'PACKAGE_SESSION',
                                recipientId: id,
                                recipientName: '',
                            },
                        ])
                    }
                />
                {/* Basic */}
                <section className="grid gap-3">
                    <Label>Title</Label>
                    <Input
                        placeholder="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={errors.title ? 'border-red-500' : ''}
                    />
                    {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
                    <Label>Content</Label>
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
                            className={`rounded border bg-white ${errors.content ? 'border-red-500' : 'border-transparent'}`}
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
                                    placeholder={'Write the announcement content'}
                                    minHeight={160}
                                />
                            </Suspense>
                        </div>
                    )}
                    {contentView === 'source' && (
                        <Textarea
                            value={htmlContent}
                            onChange={(e) => setHtmlContent(e.target.value)}
                            className={`min-h-[160px] ${errors.content ? 'border-red-500' : ''}`}
                            placeholder="Paste or edit raw HTML for the announcement..."
                        />
                    )}
                    {/* Preview Modal */}
                    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                        <DialogContent className="w-[95vw] max-w-none">
                            <DialogHeader>
                                <DialogTitle>Preview</DialogTitle>
                                <div className="mt-2 flex items-center gap-2">
                                    <Button
                                        variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                                        size="sm"
                                        aria-pressed={previewDevice === 'mobile'}
                                        onClick={() => setPreviewDevice('mobile')}
                                    >
                                        <Smartphone className="mr-1 size-3.5" /> Mobile
                                    </Button>
                                    <Button
                                        variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                                        size="sm"
                                        aria-pressed={previewDevice === 'tablet'}
                                        onClick={() => setPreviewDevice('tablet')}
                                    >
                                        <Tablet className="mr-1 size-3.5" /> Tablet
                                    </Button>
                                    <Button
                                        variant={previewDevice === 'laptop' ? 'default' : 'outline'}
                                        size="sm"
                                        aria-pressed={previewDevice === 'laptop'}
                                        onClick={() => setPreviewDevice('laptop')}
                                    >
                                        <Laptop className="mr-1 size-3.5" /> Laptop
                                    </Button>
                                </div>
                            </DialogHeader>
                            <div className="flex max-h-[80vh] w-full items-center justify-center overflow-auto p-2">
                                <div
                                    className="mx-auto overflow-hidden rounded border bg-white shadow"
                                    style={{
                                        width: DEVICE_PRESETS[previewDevice].width,
                                        height: '75vh',
                                        transition: 'width 200ms ease',
                                    }}
                                >
                                    <iframe
                                        title="Announcement Preview"
                                        sandbox="allow-same-origin"
                                        className="size-full"
                                        srcDoc={
                                            isFullHtmlDoc
                                                ? htmlContent
                                                : `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=${DEVICE_PRESETS[previewDevice].width}, initial-scale=1" /><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;padding:16px;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial}img,video{max-width:100%;height:auto}.container,.ProseMirror{max-width:none!important}</style></head><body>${htmlContent}</body></html>`
                                        }
                                    />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                    {errors.content && <p className="text-xs text-red-600">{errors.content}</p>}
                </section>

                <Separator />

                {/* Recipients */}
                <section className="grid gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Recipients</h3>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => addRecipientPreset('ALL_STUDENTS')}
                            >
                                + All Students
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => addRecipientPreset('ALL_TEACHERS')}
                            >
                                + All Teachers
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={addBatchRecipient}
                                disabled={packageSessionOptions.length === 0}
                            >
                                + Add {getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() =>
                                    setRecipients((prev) => [
                                        ...prev,
                                        {
                                            recipientType: 'ROLE',
                                            recipientId: 'STUDENT',
                                            recipientName: '',
                                        },
                                    ])
                                }
                            >
                                Add
                            </Button>
                            <Button
                                variant="secondary"
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
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Tags target users linked to the selected tags. If multiple tags are
                        selected, users with any of those tags will receive the announcement.
                        Recipients (Role/Package Session/User/Tag) may be mixed; server dedupes.
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
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                        <Select
                                            value={r.recipientType}
                                            onValueChange={(val) => {
                                                const updated = [...recipients];
                                                updated[idx] = {
                                                    ...r,
                                                    recipientType: val as
                                                        | 'ROLE'
                                                        | 'USER'
                                                        | 'PACKAGE_SESSION'
                                                        | 'PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES'
                                                        | 'TAG'
                                                        | 'CUSTOM_FIELD_FILTER'
                                                        | 'AUDIENCE',
                                                    recipientId: '',
                                                };
                                                setRecipients(updated);
                                                // Initialize/clear tag selections when switching types
                                                setTagSelections((prev) => {
                                                    const next = { ...prev };
                                                    if (val === 'TAG') next[idx] = next[idx] || [];
                                                    else delete next[idx];
                                                    return next;
                                                });
                                                setTagFilterByRow((prev) => {
                                                    const next = { ...prev };
                                                    if (val === 'TAG')
                                                        next[idx] = next[idx] || 'ALL';
                                                    else delete next[idx];
                                                    return next;
                                                });
                                                // Clear custom field filters when switching types
                                                if (val !== 'CUSTOM_FIELD_FILTER') {
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
                                            <SelectTrigger>
                                                <SelectValue placeholder="Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ROLE">ROLE</SelectItem>
                                                <SelectItem value="PACKAGE_SESSION">
                                                    {getTerminology(
                                                        ContentTerms.Batch,
                                                        SystemTerms.Batch
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="USER">USER</SelectItem>
                                                <SelectItem value="TAG">TAG</SelectItem>
                                                <SelectItem value="AUDIENCE">Campaign</SelectItem>
                                                {customFieldOptions.length > 0 && (
                                                    <SelectItem value="CUSTOM_FIELD_FILTER">
                                                        Custom Field Filter
                                                    </SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {r.recipientType === 'ROLE' ? (
                                            <Select
                                                value={r.recipientId}
                                                onValueChange={(val) => {
                                                    const updated = [...recipients];
                                                    updated[idx] = { ...r, recipientId: val };
                                                    setRecipients(updated);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                                    <SelectItem value="TEACHER">TEACHER</SelectItem>
                                                    <SelectItem value="STUDENT">STUDENT</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : r.recipientType === 'PACKAGE_SESSION' ? (
                                            <div className="space-y-2">
                                                <SearchableSelect
                                                    value={r.recipientId || ''}
                                                    onChange={(val) => {
                                                        const updated = [...recipients];
                                                        updated[idx] = { ...r, recipientId: val };
                                                        setRecipients(updated);
                                                        // Clear role selection if batch is not sub-org
                                                        const batchOption =
                                                            packageSessionOptions.find(
                                                                (opt) => opt.id === val
                                                            );
                                                        if (!batchOption?.is_org_associated) {
                                                            setBatchRoleSelections((prev) => {
                                                                const next = { ...prev };
                                                                delete next[idx];
                                                                return next;
                                                            });
                                                        }
                                                    }}
                                                    options={packageSessionOptions
                                                        .filter(
                                                            (opt) => opt.id && opt.id.trim() !== ''
                                                        )
                                                        .map((opt) => ({
                                                            value: opt.id,
                                                            label: opt.label,
                                                        }))}
                                                    placeholder="Select Package Session"
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
                                                            <SelectTrigger>
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
                                        ) : r.recipientType === 'USER' ? (
                                            <Input
                                                placeholder={'User ID'}
                                                value={r.recipientId}
                                                onChange={(e) => {
                                                    const updated = [...recipients];
                                                    updated[idx] = {
                                                        ...r,
                                                        recipientId: e.target.value,
                                                    };
                                                    setRecipients(updated);
                                                }}
                                            />
                                        ) : r.recipientType === 'CUSTOM_FIELD_FILTER' ? (
                                            <div className="col-span-2 flex-1 space-y-3">
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
                                                                                {customFieldOptions.map(
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
                                        ) : r.recipientType === 'TAG' ? (
                                            <div className="col-span-2">
                                                <div className="mb-1 flex items-center gap-2">
                                                    <Label className="text-xs">Filter</Label>
                                                    <Select
                                                        value={tagFilterByRow[idx] || 'ALL'}
                                                        onValueChange={(val) =>
                                                            setTagFilterByRow((prev) => ({
                                                                ...prev,
                                                                [idx]: val as
                                                                    | 'ALL'
                                                                    | 'DEFAULT'
                                                                    | 'INSTITUTE',
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="h-7 w-40 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ALL">All</SelectItem>
                                                            <SelectItem value="DEFAULT">
                                                                Default
                                                            </SelectItem>
                                                            <SelectItem value="INSTITUTE">
                                                                Institute
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <MultiSelect
                                                    options={(() => {
                                                        const filter = tagFilterByRow[idx] || 'ALL';
                                                        if (filter === 'ALL') return tagOptions;
                                                        const filtered = tagOptions.filter(
                                                            (opt) => {
                                                                const tag = tagMapById[opt.value];
                                                                if (!tag) return true;
                                                                if (filter === 'DEFAULT')
                                                                    return Boolean(tag.defaultTag);
                                                                return !tag.defaultTag;
                                                            }
                                                        );
                                                        return filtered;
                                                    })()}
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
                                                    If multiple tags are selected, users with any of
                                                    those tags will receive the announcement.
                                                </div>
                                                {Array.isArray(tagSelections[idx]) &&
                                                    (tagSelections[idx]?.length ?? 0) > 0 && (
                                                        <div className="mt-1 text-xs text-neutral-600">
                                                            {' '}
                                                            Estimated users for this row:{' '}
                                                            {rowTagEstimates[idx] ?? '—'}
                                                        </div>
                                                    )}
                                            </div>
                                        ) : r.recipientType === 'AUDIENCE' ? (
                                            <Select
                                                value={r.recipientId}
                                                onValueChange={(v) => {
                                                    const campaign = campaignOptions.find(
                                                        (opt) =>
                                                            opt.id === v || opt.campaign_id === v
                                                    );
                                                    const updated = [...recipients];
                                                    updated[idx] = {
                                                        ...r,
                                                        recipientId:
                                                            campaign?.id ||
                                                            campaign?.campaign_id ||
                                                            v,
                                                        recipientName:
                                                            campaign?.campaign_name || '',
                                                    };
                                                    setRecipients(updated);
                                                }}
                                            >
                                                <SelectTrigger>
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
                                        ) : null}
                                        <Button
                                            variant="ghost"
                                            onClick={() => removeRecipientAtIndex(idx)}
                                        >
                                            Remove
                                        </Button>
                                    </div>

                                    {/* Exclusions and Custom Fields - shown after selecting recipient type and ID */}
                                    {showOptions && (
                                        <div className="space-y-3 rounded-md border p-3">
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
                                                key={`${idx}-${id}`}
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
                                if (r.recipientType === 'CUSTOM_FIELD_FILTER') {
                                    const filters = customFieldFilters[idx] || [];
                                    const filterText = filters
                                        .filter((f) => f.fieldId && f.filterValue)
                                        .map(
                                            (f) =>
                                                `${f.fieldName}: ${Array.isArray(f.filterValue) ? f.filterValue.join(', ') : f.filterValue}`
                                        )
                                        .join('; ');
                                    return (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5"
                                        >
                                            <span className="font-medium">CUSTOM_FIELD_FILTER</span>
                                            <span className="text-neutral-600">
                                                {filterText || '—'}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-neutral-500 hover:text-neutral-800"
                                                onClick={() => removeRecipientAtIndex(idx)}
                                                aria-label="Remove custom field filter"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    );
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
                                                : r.recipientType === 'AUDIENCE'
                                                  ? 'Campaign'
                                                  : r.recipientType}
                                        </span>
                                        <span className="text-neutral-600">
                                            {r.recipientType === 'PACKAGE_SESSION'
                                                ? packageSessionOptions.find(
                                                      (opt) => opt.id === r.recipientId
                                                  )?.label ||
                                                  r.recipientId ||
                                                  '—'
                                                : r.recipientType === 'AUDIENCE'
                                                  ? r.recipientName ||
                                                    campaignOptions.find(
                                                        (opt) =>
                                                            opt.id === r.recipientId ||
                                                            opt.campaign_id === r.recipientId
                                                    )?.campaign_name ||
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
                    {/* Estimated users (optional UX) */}
                    {Object.values(tagSelections).flat().length > 0 && (
                        <div className="text-xs text-neutral-600">
                            {estimatingUsers
                                ? 'Estimating users…'
                                : `Estimated users (any of selected tags): ${estimatedUsers ?? '—'}`}
                        </div>
                    )}
                </section>

                <Separator />

                {/* Modes */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Modes</h3>
                    <p className="text-sm text-muted-foreground">
                        Pick where and how your announcement appears. Choose one or more modes.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyModePreset('GENERAL')}
                        >
                            General Announcement
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyModePreset('PINNED')}
                        >
                            Pinned Update
                        </Button>
                    </div>
                    {loadingPermissions ? (
                        <div className="text-sm text-neutral-500">Loading permissions…</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {getModeMeta({
                                title,
                                contentText: extractTextFromHtml(htmlContent),
                            }).map((meta) => {
                                const selected = selectedModes.includes(meta.type);
                                const disabled = allowedModes[meta.type] === false;
                                return (
                                    <ModeCard
                                        key={meta.type}
                                        label={meta.label}
                                        description={meta.description}
                                        Icon={meta.Icon}
                                        selected={selected}
                                        disabled={disabled}
                                        onToggle={() => {
                                            if (disabled) return;
                                            const willSelect = !selected;
                                            setSelectedModes((prev) =>
                                                willSelect
                                                    ? [...prev, meta.type]
                                                    : prev.filter((x) => x !== meta.type)
                                            );
                                            if (willSelect && !modeSettings[meta.type]) {
                                                setModeSettings((prev) => ({
                                                    ...prev,
                                                    [meta.type]: defaultModeSettings(meta.type),
                                                }));
                                            }
                                        }}
                                    >
                                        {meta.renderPreview()}
                                    </ModeCard>
                                );
                            })}
                        </div>
                    )}

                    {/* Mode-specific settings */}
                    <div className="grid gap-4">
                        {selectedModes.map((m) => (
                            <div key={m} className="rounded-md border p-4">
                                <div className="mb-2 font-medium">{m} settings</div>
                                {renderModeSettingsForm(
                                    m,
                                    modeSettings[m],
                                    (updated) =>
                                        setModeSettings((prev) => ({ ...prev, [m]: updated })),
                                    errors,
                                    `modes.${m}`
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Mediums */}
                <section className="grid gap-3">
                    <h3 className="text-lg font-medium">Mediums</h3>
                    <p className="text-sm text-muted-foreground">
                        Select channels to deliver this announcement. Email will reuse the Title and
                        Content.
                    </p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {(['PUSH_NOTIFICATION', 'EMAIL', 'WHATSAPP'] as MediumType[]).map((med) => (
                            <label key={med} className="flex items-center gap-2">
                                <Checkbox
                                    checked={selectedMediums.includes(med)}
                                    onCheckedChange={(checked) => {
                                        const isChecked = Boolean(checked);
                                        setSelectedMediums((prev) =>
                                            isChecked
                                                ? [...prev, med]
                                                : prev.filter((x) => x !== med)
                                        );
                                    }}
                                />
                                <span>{med}</span>
                            </label>
                        ))}
                    </div>

                    {/* Medium configs */}
                    <div className="grid gap-4">
                        {selectedMediums.includes('PUSH_NOTIFICATION') && (
                            <div className="rounded-md border p-4">
                                <div className="mb-2 font-medium">Push Notification</div>
                                <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
                                    <Switch
                                        checked={syncPushFromTitleContent}
                                        onCheckedChange={(v) =>
                                            setSyncPushFromTitleContent(Boolean(v))
                                        }
                                    />
                                    <span>Sync from Title and Content</span>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    <Input
                                        placeholder="Title"
                                        value={
                                            (mediumConfigs.PUSH_NOTIFICATION?.title as string) ?? ''
                                        }
                                        onChange={(e) =>
                                            setMediumConfigs((prev) => ({
                                                ...prev,
                                                PUSH_NOTIFICATION: {
                                                    ...prev.PUSH_NOTIFICATION,
                                                    title: e.target.value,
                                                },
                                            }))
                                        }
                                        disabled={syncPushFromTitleContent}
                                    />
                                    <Input
                                        placeholder="Body"
                                        value={
                                            (mediumConfigs.PUSH_NOTIFICATION?.body as string) ?? ''
                                        }
                                        onChange={(e) =>
                                            setMediumConfigs((prev) => ({
                                                ...prev,
                                                PUSH_NOTIFICATION: {
                                                    ...prev.PUSH_NOTIFICATION,
                                                    body: e.target.value,
                                                },
                                            }))
                                        }
                                        disabled={syncPushFromTitleContent}
                                    />
                                </div>
                                {/* push counters */}
                                <div className="mt-1 grid gap-2 text-[11px] text-neutral-600 md:grid-cols-2">
                                    <div>Title length: {pushTitleLen} (recommended ≤ 50)</div>
                                    <div>Body length: {pushBodyLen} (recommended ≤ 150)</div>
                                </div>
                                {/* push preview */}
                                <div className="mt-3 max-w-sm rounded-lg border bg-white p-3 shadow-sm">
                                    <div className="text-xs font-medium text-neutral-500">
                                        Push Preview
                                    </div>
                                    <div className="mt-1">
                                        <div className="text-sm font-semibold">
                                            {(mediumConfigs.PUSH_NOTIFICATION?.title as string) ||
                                                'Title'}
                                        </div>
                                        <div className="text-xs text-neutral-700">
                                            {(mediumConfigs.PUSH_NOTIFICATION?.body as string) ||
                                                'Body preview'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {selectedMediums.includes('EMAIL') && (
                            <div className="rounded-md border p-4">
                                <div className="mb-2 font-medium">Email</div>

                                {/* Template checkbox */}
                                <div className="mb-4 flex items-center gap-2">
                                    <Checkbox
                                        id="use-template"
                                        checked={useTemplate}
                                        onCheckedChange={async (checked) => {
                                            setUseTemplate(Boolean(checked));
                                            if (checked) {
                                                // Load templates when checkbox is checked
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

                                {/* Template dropdown */}
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
                                                        {emailTemplates.map((template) => (
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
                                        {selectedTemplateId &&
                                            selectedTemplateId !== 'add-new-template' && (
                                                <div className="mt-2 text-xs text-neutral-600">
                                                    Template selected:{' '}
                                                    {
                                                        emailTemplates.find(
                                                            (t) => t.id === selectedTemplateId
                                                        )?.name
                                                    }
                                                </div>
                                            )}
                                        {templatesError && (
                                            <div className="mt-2 text-xs text-red-600">
                                                {templatesError}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* From Email selection */}
                                <div className="mb-4">
                                    <Label className="mb-2 block text-sm font-medium">
                                        From Email
                                    </Label>
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
                                                emailConfigurations.map((config, index) => {
                                                    const uniqueValue = `${config.email}-${config.name}`;
                                                    return (
                                                        <SelectItem
                                                            key={`${config.email}-${index}`}
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
                                                    (c) =>
                                                        `${c.email}-${c.name}` === selectedFromEmail
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
                            </div>
                        )}
                        {selectedMediums.includes('WHATSAPP') && (
                            <div className="rounded-md border p-4">
                                <div className="mb-2 font-medium">WhatsApp</div>
                                <div className="grid gap-2">
                                    <Input
                                        placeholder="Template Name"
                                        value={(mediumConfigs.WHATSAPP?.template as string) ?? ''}
                                        onChange={(e) =>
                                            setMediumConfigs((prev) => ({
                                                ...prev,
                                                WHATSAPP: {
                                                    ...prev.WHATSAPP,
                                                    template: e.target.value,
                                                },
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        )}
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
                                onClick={() => applyScheduleQuickPick('TODAY_5PM')}
                            >
                                Later today 5pm
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('TOMORROW_9AM')}
                            >
                                Tomorrow 9am
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyScheduleQuickPick('NEXT_MON_9AM')}
                            >
                                Next Monday 9am
                            </Button>
                        </div>
                    </div>
                    {scheduleType === 'ONE_TIME' && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <Label>Run at</Label>
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
                        </div>
                    )}
                    {scheduleType === 'RECURRING' && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
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
                            </div>
                            <div>
                                <Label>Templates</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => applyCronTemplate('DAILY_9')}
                                    >
                                        Every day at 9 AM
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => applyCronTemplate('MON_9')}
                                    >
                                        Every Monday 9 AM
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => applyCronTemplate('HOURLY')}
                                    >
                                        Every hour
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <Separator />

                <div className="flex gap-2">
                    <Button
                        disabled={
                            isSubmitting || !title || !htmlContent || selectedModes.length === 0
                        }
                        onClick={async () => {
                            try {
                                // Validate required fields per selected mode
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

                                for (const m of selectedModes) {
                                    const s = (modeSettings[m] || {}) as Record<string, unknown>;
                                    if (m === 'SYSTEM_ALERT') {
                                        const p = (s.priority as string) || '';
                                        if (!p) {
                                            validationErrors.push(
                                                'SYSTEM_ALERT: priority is required'
                                            );
                                            fieldErrors['modes.SYSTEM_ALERT.priority'] =
                                                'Priority is required';
                                        }
                                    }
                                    if (m === 'DASHBOARD_PIN') {
                                        const start = (s.pinStartTime as string) || '';
                                        const end = (s.pinEndTime as string) || '';
                                        const pos = (s.position as string) || '';
                                        if (!pos) {
                                            validationErrors.push(
                                                'DASHBOARD_PIN: position is required'
                                            );
                                            fieldErrors['modes.DASHBOARD_PIN.position'] =
                                                'Position is required';
                                        }
                                        if (!start || !end) {
                                            validationErrors.push(
                                                'DASHBOARD_PIN: start and end time are required'
                                            );
                                            if (!start)
                                                fieldErrors['modes.DASHBOARD_PIN.pinStartTime'] =
                                                    'Start time is required';
                                            if (!end)
                                                fieldErrors['modes.DASHBOARD_PIN.pinEndTime'] =
                                                    'End time is required';
                                        }
                                        if (start && end && new Date(start) >= new Date(end)) {
                                            validationErrors.push(
                                                'DASHBOARD_PIN: end time must be after start time'
                                            );
                                            fieldErrors['modes.DASHBOARD_PIN.pinEndTime'] =
                                                'End time must be after start';
                                        }
                                    }
                                    if (m === 'RESOURCES') {
                                        const folder = (s.folderName as string) || '';
                                        if (!folder) {
                                            validationErrors.push(
                                                'RESOURCES: folderName is required'
                                            );
                                            fieldErrors['modes.RESOURCES.folderName'] =
                                                'Folder name is required';
                                        }
                                    }
                                    if (m === 'COMMUNITY') {
                                        const cType = (s.communityType as string) || '';
                                        if (!cType) {
                                            validationErrors.push(
                                                'COMMUNITY: communityType is required'
                                            );
                                            fieldErrors['modes.COMMUNITY.communityType'] =
                                                'Community type is required';
                                        }
                                    }
                                    if (m === 'TASKS') {
                                        const slides = (s.slideIds as string[] | undefined) || [];
                                        const goLive = (s.goLiveDateTime as string) || '';
                                        const deadline = (s.deadlineDateTime as string) || '';
                                        const tTitle = (s.taskTitle as string) || '';
                                        if (!tTitle) {
                                            validationErrors.push('TASKS: taskTitle is required');
                                            fieldErrors['modes.TASKS.taskTitle'] =
                                                'Task title is required';
                                        }
                                        if (!slides.length) {
                                            validationErrors.push(
                                                'TASKS: slideIds must include at least one slide'
                                            );
                                            fieldErrors['modes.TASKS.slideIds'] =
                                                'At least one slide is required';
                                        }
                                        if (!goLive || !deadline) {
                                            validationErrors.push(
                                                'TASKS: go live and deadline are required'
                                            );
                                            if (!goLive)
                                                fieldErrors['modes.TASKS.goLiveDateTime'] =
                                                    'Go live is required';
                                            if (!deadline)
                                                fieldErrors['modes.TASKS.deadlineDateTime'] =
                                                    'Deadline is required';
                                        }
                                        if (
                                            goLive &&
                                            deadline &&
                                            new Date(goLive) >= new Date(deadline)
                                        ) {
                                            validationErrors.push(
                                                'TASKS: deadline must be after go live'
                                            );
                                            fieldErrors['modes.TASKS.deadlineDateTime'] =
                                                'Deadline must be after go live';
                                        }
                                    }
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
                                        validationErrors.push(
                                            'Schedule: cron expression is required for recurring'
                                        );
                                        fieldErrors['schedule.cronExpression'] =
                                            'Cron expression is required';
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

                                // Validate TAG recipients (require institute and at least one tag per TAG row)
                                const anyTagRow = recipients.some((r) => r.recipientType === 'TAG');
                                if (anyTagRow) {
                                    const missingTags = recipients.some(
                                        (r, idx) =>
                                            r.recipientType === 'TAG' && !tagSelections[idx]?.length
                                    );
                                    if (missingTags) {
                                        toast({
                                            title: 'Select at least one tag',
                                            description:
                                                'You have a TAG recipient without any selected tags.',
                                            variant: 'destructive',
                                        });
                                        return;
                                    }
                                    const instId = getInstituteId();
                                    if (!instId) {
                                        toast({
                                            title: 'Institute required',
                                            description:
                                                'An institute must be selected to target TAG recipients.',
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
                                        return (
                                            !filters ||
                                            !filters.some((f) => f.fieldId && f.filterValue)
                                        );
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

                                // Expand TAG selections into recipient entries with names
                                const expandedRecipients: CreateAnnouncementRequest['recipients'] =
                                    [];
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
                                    const recipientCustomFieldFilters =
                                        customFieldFilters[idx] || [];
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
                                                recipientId:
                                                    r.recipientId || `custom-filter-${idx}`,
                                                recipientName: r.recipientName,
                                                customFieldFilters: validCustomFieldFilters,
                                                exclusions:
                                                    validRecipientExclusions.length > 0
                                                        ? validRecipientExclusions
                                                        : undefined,
                                            });
                                        }
                                    } else if (
                                        r.recipientType === 'PACKAGE_SESSION' &&
                                        r.recipientId
                                    ) {
                                        const batchOption = packageSessionOptions.find(
                                            (opt) => opt.id === r.recipientId
                                        );
                                        const selectedRole = batchRoleSelections[idx];

                                        // Check if it's a sub-org batch with role selection
                                        if (batchOption?.is_org_associated && selectedRole) {
                                            // Use PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES format: packageSessionId:ROLE1,ROLE2
                                            expandedRecipients.push({
                                                recipientType:
                                                    'PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES',
                                                recipientId: `${r.recipientId}:${selectedRole}`,
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
                                                recipientName:
                                                    r.recipientName || batchOption?.label,
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
                                const payload: any = {
                                    title,
                                    content: { type: 'html', content: htmlContent },
                                    createdBy: getUserId(),
                                    createdByName: getUserName(),
                                    createdByRole: primaryRole,
                                    recipients: expandedRecipients,
                                    // Global exclusions are currently not processed, but kept for backward compatibility
                                    exclusions: undefined,
                                    modes: selectedModes.map((m) => ({
                                        modeType: m,
                                        settings: modeSettings[m] ?? {},
                                    })),
                                    mediums: selectedMediums.map((med) => {
                                        if (med === 'EMAIL') {
                                            const selectedConfig = emailConfigurations.find(
                                                (c) => `${c.email}-${c.name}` === selectedFromEmail
                                            );
                                            const emailType =
                                                selectedConfig?.type || 'UTILITY_EMAIL';

                                            return {
                                                mediumType: med,
                                                config: {
                                                    subject: title,
                                                    emailType: emailType,
                                                },
                                            };
                                        }
                                        return {
                                            mediumType: med,
                                            config: mediumConfigs[med] ?? {},
                                        };
                                    }),
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
                                                    endDate: oneTimeEnd
                                                        ? new Date(oneTimeEnd).toISOString()
                                                        : undefined,
                                                }
                                              : {
                                                    scheduleType,
                                                    timezone,
                                                    cronExpression: cronExpression || undefined,
                                                },
                                };
                                await AnnouncementService.create(payload);
                                // Fire a success Sonner toast immediately
                                try {
                                    const { toast: sonnerToast } = await import('sonner');
                                    sonnerToast.success('Announcement created');
                                } catch {
                                    // fallback to existing toast
                                    toast({ title: 'Announcement created' });
                                }
                                // Reset minimal fields
                                setTitle('');
                                setHtmlContent('');
                                setSelectedModes([]);
                                setModeSettings({} as Record<ModeType, Record<string, unknown>>);
                                setSelectedMediums(['PUSH_NOTIFICATION']);
                            } catch (err: unknown) {
                                // Try to parse API validation errors and show inline + toast
                                const anyErr = err as {
                                    response?: {
                                        data?: {
                                            details?: Record<string, string>;
                                            message?: string;
                                        };
                                    };
                                };
                                const details = anyErr?.response?.data?.details as
                                    | Record<string, string>
                                    | undefined;

                                if (details && typeof details === 'object') {
                                    const fieldErrors: Record<string, string> = {};

                                    Object.entries(details).forEach(([key, message]) => {
                                        // Map backend field paths to our local error keys
                                        if (key.startsWith('scheduling.')) {
                                            // scheduling.startDate -> schedule.startDate
                                            const localKey = `schedule.${key.split('.').slice(1).join('.')}`;
                                            fieldErrors[localKey] = message;
                                        } else if (key.startsWith('content.')) {
                                            fieldErrors['content'] = message;
                                        } else if (key === 'title') {
                                            fieldErrors['title'] = message;
                                        } else {
                                            // Fallback: attach to a general bucket if needed
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
                        }}
                    >
                        {isSubmitting ? 'Submitting…' : 'Create Announcement'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsReviewOpen(true)}
                        disabled={isSubmitting}
                    >
                        Review and Create
                    </Button>
                </div>
            </div>
        </div>
    );
}

function defaultModeSettings(mode: ModeType): Record<string, unknown> {
    switch (mode) {
        case 'SYSTEM_ALERT':
            return { priority: 'HIGH', expiresAt: '' };
        case 'DASHBOARD_PIN':
            return { priority: 10, pinStartTime: '', pinEndTime: '', position: 'TOP' };
        case 'DM':
            return { messagePriority: 5, allowReplies: true };
        case 'STREAM':
            return { packageSessionId: '', streamType: 'LIVE' };
        case 'RESOURCES':
            return { folderName: '', category: '', accessLevel: 'STUDENTS' };
        case 'COMMUNITY':
            return { communityType: 'SCHOOL', tags: [] };
        case 'TASKS':
            return {
                slideIds: [],
                goLiveDateTime: '',
                deadlineDateTime: '',
                status: 'SCHEDULED',
                taskTitle: '',
                taskDescription: '',
                estimatedDurationMinutes: 0,
                maxAttempts: 1,
                isMandatory: false,
                autoStatusUpdate: true,
                reminderBeforeMinutes: 0,
            };
    }
}

// Batch preset dialog
// Keep minimal UX to paste a Package Session ID
function BatchDialog({
    open,
    onOpenChange,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onConfirm: (id: string) => void;
}) {
    const [val, setVal] = useState('');
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Add Specific {getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
                    </DialogTitle>
                    <DialogDescription>
                        Enter a Package Session ID to target a specific batch.
                    </DialogDescription>
                </DialogHeader>
                <Input
                    placeholder="Package Session ID"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                />
                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            if (!val) return;
                            onConfirm(val);
                            onOpenChange(false);
                        }}
                    >
                        Add
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function renderModeSettingsForm(
    mode: ModeType,
    settings: Record<string, unknown>,
    onChange: (updated: Record<string, unknown>) => void,
    errors?: Record<string, string>,
    errorPrefix?: string
) {
    const set = (key: string, value: unknown) => onChange({ ...settings, [key]: value });
    switch (mode) {
        case 'SYSTEM_ALERT':
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <Select
                        value={(settings.priority as string) || 'LOW'}
                        onValueChange={(v) => set('priority', v)}
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
                    <div>
                        <Label>Expires At</Label>
                        <Input
                            type="datetime-local"
                            value={(settings.expiresAt as string) || ''}
                            onChange={(e) => set('expiresAt', e.target.value)}
                        />
                        {errors && errorPrefix && errors[`${errorPrefix}.priority`] && (
                            <p className="text-xs text-red-600">
                                {errors[`${errorPrefix}.priority`]}
                            </p>
                        )}
                    </div>
                </div>
            );

        case 'DASHBOARD_PIN':
            return (
                <div className="grid gap-3 md:grid-cols-4">
                    <Input
                        type="number"
                        placeholder="Priority"
                        value={Number(settings.priority ?? 10)}
                        onChange={(e) => set('priority', Number(e.target.value))}
                    />
                    <Select
                        value={(settings.position as string) || 'TOP'}
                        onValueChange={(v) => set('position', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Position" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TOP">TOP</SelectItem>
                            <SelectItem value="BOTTOM">BOTTOM</SelectItem>
                        </SelectContent>
                    </Select>
                    <div>
                        <Label>Pin Start</Label>
                        <Input
                            type="datetime-local"
                            value={(settings.pinStartTime as string) || ''}
                            onChange={(e) => set('pinStartTime', e.target.value)}
                        />
                        {errors && errorPrefix && errors[`${errorPrefix}.pinStartTime`] && (
                            <p className="text-xs text-red-600">
                                {errors[`${errorPrefix}.pinStartTime`]}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label>Pin End</Label>
                        <Input
                            type="datetime-local"
                            value={(settings.pinEndTime as string) || ''}
                            onChange={(e) => set('pinEndTime', e.target.value)}
                        />
                        {errors && errorPrefix && errors[`${errorPrefix}.pinEndTime`] && (
                            <p className="text-xs text-red-600">
                                {errors[`${errorPrefix}.pinEndTime`]}
                            </p>
                        )}
                    </div>
                    {errors && errorPrefix && errors[`${errorPrefix}.position`] && (
                        <p className="col-span-4 text-xs text-red-600">
                            {errors[`${errorPrefix}.position`]}
                        </p>
                    )}
                </div>
            );

        case 'DM':
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        type="number"
                        placeholder="Message Priority"
                        value={Number(settings.messagePriority ?? 5)}
                        onChange={(e) => set('messagePriority', Number(e.target.value))}
                    />
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={Boolean(settings.allowReplies)}
                            onCheckedChange={(v) => set('allowReplies', Boolean(v))}
                        />
                        <Label>Allow Replies</Label>
                    </div>
                </div>
            );

        case 'STREAM':
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        placeholder="Package Session ID"
                        value={(settings.packageSessionId as string) || ''}
                        onChange={(e) => set('packageSessionId', e.target.value)}
                    />
                    <Select
                        value={(settings.streamType as string) || 'LIVE'}
                        onValueChange={(v) => set('streamType', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Stream Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LIVE">LIVE</SelectItem>
                            <SelectItem value="RECORDED">RECORDED</SelectItem>
                            <SelectItem value="UPCOMING">UPCOMING</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            );

        case 'RESOURCES':
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <Input
                        placeholder="Folder Name"
                        value={(settings.folderName as string) || ''}
                        onChange={(e) => set('folderName', e.target.value)}
                    />
                    {errors && errorPrefix && errors[`${errorPrefix}.folderName`] && (
                        <p className="text-xs text-red-600">
                            {errors[`${errorPrefix}.folderName`]}
                        </p>
                    )}
                    <Input
                        placeholder="Category"
                        value={(settings.category as string) || ''}
                        onChange={(e) => set('category', e.target.value)}
                    />
                    <Select
                        value={(settings.accessLevel as string) || 'STUDENTS'}
                        onValueChange={(v) => set('accessLevel', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Access Level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="STUDENTS">STUDENTS</SelectItem>
                            <SelectItem value="TEACHERS">TEACHERS</SelectItem>
                            <SelectItem value="ALL">ALL</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            );

        case 'COMMUNITY':
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <Select
                        value={(settings.communityType as string) || 'SCHOOL'}
                        onValueChange={(v) => set('communityType', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Community Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="SCHOOL">SCHOOL</SelectItem>
                            <SelectItem value="CLASS">CLASS</SelectItem>
                            <SelectItem value="CLUB">CLUB</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors && errorPrefix && errors[`${errorPrefix}.communityType`] && (
                        <p className="text-xs text-red-600">
                            {errors[`${errorPrefix}.communityType`]}
                        </p>
                    )}
                    <Input
                        placeholder="Tags (comma separated)"
                        value={
                            Array.isArray(settings.tags)
                                ? (settings.tags as string[]).join(',')
                                : ''
                        }
                        onChange={(e) =>
                            set(
                                'tags',
                                e.target.value.split(',').map((t) => t.trim())
                            )
                        }
                    />
                </div>
            );

        case 'TASKS':
            return (
                <div className="grid gap-3 md:grid-cols-2">
                    <Input
                        placeholder="Task Title"
                        value={(settings.taskTitle as string) || ''}
                        onChange={(e) => set('taskTitle', e.target.value)}
                    />
                    {errors && errorPrefix && errors[`${errorPrefix}.taskTitle`] && (
                        <p className="text-xs text-red-600">{errors[`${errorPrefix}.taskTitle`]}</p>
                    )}
                    <Input
                        placeholder="Estimated Minutes"
                        type="number"
                        value={Number(settings.estimatedDurationMinutes ?? 0)}
                        onChange={(e) => set('estimatedDurationMinutes', Number(e.target.value))}
                    />
                    <Textarea
                        placeholder="Task Description"
                        value={(settings.taskDescription as string) || ''}
                        onChange={(e) => set('taskDescription', e.target.value)}
                    />
                    <Input
                        placeholder="Slide IDs (comma separated)"
                        value={
                            Array.isArray(settings.slideIds)
                                ? (settings.slideIds as string[]).join(',')
                                : ''
                        }
                        onChange={(e) =>
                            set(
                                'slideIds',
                                e.target.value.split(',').map((t) => t.trim())
                            )
                        }
                    />
                    {errors && errorPrefix && errors[`${errorPrefix}.slideIds`] && (
                        <p className="text-xs text-red-600">{errors[`${errorPrefix}.slideIds`]}</p>
                    )}
                    <div>
                        <Label>Go Live</Label>
                        <Input
                            type="datetime-local"
                            value={(settings.goLiveDateTime as string) || ''}
                            onChange={(e) => set('goLiveDateTime', e.target.value)}
                        />
                        {errors && errorPrefix && errors[`${errorPrefix}.goLiveDateTime`] && (
                            <p className="text-xs text-red-600">
                                {errors[`${errorPrefix}.goLiveDateTime`]}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label>Deadline</Label>
                        <Input
                            type="datetime-local"
                            value={(settings.deadlineDateTime as string) || ''}
                            onChange={(e) => set('deadlineDateTime', e.target.value)}
                        />
                        {errors && errorPrefix && errors[`${errorPrefix}.deadlineDateTime`] && (
                            <p className="text-xs text-red-600">
                                {errors[`${errorPrefix}.deadlineDateTime`]}
                            </p>
                        )}
                    </div>
                    <Select
                        value={(settings.status as string) || 'SCHEDULED'}
                        onValueChange={(v) => set('status', v)}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DRAFT">DRAFT</SelectItem>
                            <SelectItem value="SCHEDULED">SCHEDULED</SelectItem>
                            <SelectItem value="LIVE">LIVE</SelectItem>
                            <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                            <SelectItem value="OVERDUE">OVERDUE</SelectItem>
                            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={Boolean(settings.isMandatory)}
                            onCheckedChange={(v) => set('isMandatory', Boolean(v))}
                        />
                        <Label>Mandatory</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={Boolean(settings.autoStatusUpdate)}
                            onCheckedChange={(v) => set('autoStatusUpdate', Boolean(v))}
                        />
                        <Label>Auto Status Update</Label>
                    </div>
                    <Input
                        placeholder="Reminder Before Minutes"
                        type="number"
                        value={Number(settings.reminderBeforeMinutes ?? 0)}
                        onChange={(e) => set('reminderBeforeMinutes', Number(e.target.value))}
                    />
                </div>
            );
    }
}

type ModeCardProps = {
    label: string;
    description: string;
    Icon: LucideIcon;
    selected: boolean;
    disabled?: boolean;
    onToggle: () => void;
    children?: React.ReactNode;
};

function ModeCard({
    label,
    description,
    Icon,
    selected,
    disabled,
    onToggle,
    children,
}: ModeCardProps) {
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className={`group flex flex-col gap-3 rounded-md border p-3 text-left transition ${
                selected
                    ? 'border-blue-600 ring-2 ring-blue-600/20'
                    : 'border-neutral-200 hover:border-neutral-300'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            aria-pressed={selected}
            aria-label={`${label} mode ${selected ? 'selected' : 'not selected'}`}
        >
            <div className="flex items-start gap-3">
                <div
                    className={`rounded-md p-2 ${
                        selected ? 'bg-blue-600/10 text-blue-700' : 'bg-neutral-50 text-neutral-600'
                    }`}
                >
                    <Icon className="size-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div className="font-medium">{label}</div>
                        <div
                            className={`size-2 rounded-full ${
                                selected
                                    ? 'bg-blue-600'
                                    : 'bg-neutral-300 group-hover:bg-neutral-400'
                            }`}
                        />
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">{description}</div>
                </div>
            </div>
            {selected && children && (
                <div className="mt-2 rounded border bg-neutral-50 p-2">
                    <div className="mb-1 text-xs font-medium text-neutral-700">Preview</div>
                    <div className="text-xs text-neutral-700">{children}</div>
                </div>
            )}
        </button>
    );
}

type ModeMeta = {
    type: ModeType;
    label: string;
    description: string;
    Icon: LucideIcon;
    renderPreview: () => JSX.Element | null;
};

function getModeMeta(ctx: { title: string; contentText: string }): ModeMeta[] {
    const { title, contentText } = ctx;
    const snippet = (contentText || '').slice(0, 120) + (contentText.length > 120 ? '…' : '');
    return [
        {
            type: 'SYSTEM_ALERT',
            label: 'System Alert',
            description:
                'General announcement. Appears in top navbar alerts for visibility to everyone.',
            Icon: Bell,
            renderPreview: () => (
                <div className="rounded bg-yellow-50 p-2 text-yellow-900">
                    <div className="flex items-center gap-2 text-[11px]">
                        <Bell className="size-3.5" />
                        <span className="font-medium">Alert</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                        <span className="font-semibold">{title || 'Announcement'}</span>
                        {': '}
                        {snippet || 'Your alert content will appear here.'}
                    </div>
                </div>
            ),
        },
        {
            type: 'DASHBOARD_PIN',
            label: 'Dashboard Pin',
            description: 'Pinned message on the dashboard for a defined time window (hours/days).',
            Icon: Pin,
            renderPreview: () => (
                <div className="rounded border border-dashed p-2">
                    <div className="flex items-center gap-2 text-[11px]">
                        <Pin className="size-3.5" />
                        <span className="font-medium">Pinned on dashboard</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                        <div className="font-semibold">{title || 'Pinned announcement'}</div>
                        <div className="text-neutral-700">
                            {snippet || 'Your pinned message will be shown here.'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            type: 'DM',
            label: 'Direct Message',
            description: 'Sends a message to users’ inbox (DM). Optionally allow replies.',
            Icon: MessageSquare,
            renderPreview: () => (
                <div className="rounded bg-white p-2">
                    <div className="flex items-center gap-2 text-[11px] text-neutral-700">
                        <MessageSquare className="size-3.5" />
                        <span className="font-medium">Inbox</span>
                    </div>
                    <div className="mt-1 rounded border bg-neutral-50 p-2 text-[11px]">
                        <div className="font-semibold">{title || 'New message'}</div>
                        <div className="text-neutral-700">
                            {snippet || 'Message preview appears here.'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            type: 'STREAM',
            label: 'Stream',
            description: 'Post to a batch/class discussion stream (e.g., 2026 – Advanced Maths).',
            Icon: Megaphone,
            renderPreview: () => (
                <div className="rounded border p-2">
                    <div className="text-[11px] font-medium">2026 – Advanced Maths Class</div>
                    <div className="mt-1 rounded bg-neutral-50 p-2 text-[11px]">
                        <div className="font-semibold">{title || 'Stream post'}</div>
                        <div className="text-neutral-700">
                            {snippet || 'Discussion message content here.'}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            type: 'RESOURCES',
            label: 'Resources',
            description: 'Share resources (folder/category). Enhancements coming soon.',
            Icon: Folder,
            renderPreview: () => (
                <div className="text-[11px] text-neutral-600">Preview coming soon.</div>
            ),
        },
        {
            type: 'COMMUNITY',
            label: 'Community',
            description: 'Post to communities. Enhancements coming soon.',
            Icon: Users,
            renderPreview: () => (
                <div className="text-[11px] text-neutral-600">Preview coming soon.</div>
            ),
        },
        {
            type: 'TASKS',
            label: 'Tasks',
            description: 'Assign tasks with timelines. Enhancements coming soon.',
            Icon: ClipboardList,
            renderPreview: () => (
                <div className="text-[11px] text-neutral-600">Preview coming soon.</div>
            ),
        },
    ];
}
