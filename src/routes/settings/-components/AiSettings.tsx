import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';

import { Sparkles, Save, ShieldCheck, Trash2, Plus, Info, Film, Palette, Type } from 'lucide-react';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    AI_SERVICE_BASE_URL,
    BASE_URL,
    GET_INSITITUTE_SETTINGS,
    GET_INSTITUTE_AI_SETTINGS,
    UPDATE_INSTITUTE_AI_SETTINGS,
    GET_VIDEO_BRANDING,
    UPDATE_VIDEO_BRANDING,
    GET_VIDEO_STYLE,
    UPDATE_VIDEO_STYLE,
    GET_VIDEO_TEMPLATES,
} from '@/constants/urls';
import { ColorPicker } from '@/components/ui/color-picker';
import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';

interface AiSettingsProps {
    isTab?: boolean;
}

interface KeysStatus {
    hasKeys: boolean;
    hasOpenAI: boolean;
    hasGemini: boolean;
    defaultModel?: string;
    isActive?: boolean;
}

interface TutorConfiguration {
    enable: boolean;
    role: string;
    assistant_name: string;
    institute_name: string;
    core_instruction: string;
    hard_rules: string[];
    adherence_settings: {
        level: 'strict' | 'moderate' | 'flexible';
        temperature: number;
    };
}

interface ActivityLogRecord {
    id: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_price: number;
    request_type: string;
    created_at: string;
}

interface ActivityLogResponse {
    records: ActivityLogRecord[];
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
}

import { useAIModelsList } from '@/hooks/useAiModels';

// ─── Video Branding & Style types ─────────────────────────────────────────

interface VideoIntroOutroConfig {
    enabled: boolean;
    duration_seconds: number;
    html: string;
}

interface VideoWatermarkConfig {
    enabled: boolean;
    position: string;
    opacity: number;
    html: string;
    max_width?: number;
    max_height?: number;
    margin?: number;
}

interface VideoBrandingConfig {
    intro: VideoIntroOutroConfig;
    outro: VideoIntroOutroConfig;
    watermark: VideoWatermarkConfig;
}

interface VideoStyleConfig {
    background_type: 'white' | 'black';
    primary_color: string;
    heading_font: string;
    body_font: string;
    layout_theme: string;
}

const DEFAULT_VIDEO_BRANDING: VideoBrandingConfig = {
    intro: { enabled: false, duration_seconds: 3, html: '' },
    outro: { enabled: false, duration_seconds: 4, html: '' },
    watermark: { enabled: false, position: 'top-right', opacity: 0.5, html: '' },
};

const DEFAULT_VIDEO_STYLE: VideoStyleConfig = {
    background_type: 'white',
    primary_color: '#6366f1',
    heading_font: 'Inter',
    body_font: 'Inter',
    layout_theme: '',
};

interface VideoTemplate {
    id: string;
    name: string;
    description: string;
    tags: string[];
    background_type: 'white' | 'black';
    preview_html: string;
}

const FONT_OPTIONS = [
    'Inter', 'Roboto', 'Open Sans', 'Poppins', 'Montserrat',
    'Lato', 'Playfair Display', 'Source Serif 4',
];

const WATERMARK_POSITIONS = [
    { value: 'top-left',     label: 'Top Left' },
    { value: 'top-right',    label: 'Top Right' },
    { value: 'bottom-left',  label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
];

const AiSettings: React.FC<AiSettingsProps> = ({ isTab }) => {
    const [openaiKey, setOpenaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [defaultModel, setDefaultModel] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingTutor, setIsSavingTutor] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [keysStatus, setKeysStatus] = useState<KeysStatus>({
        hasKeys: false,
        hasOpenAI: false,
        hasGemini: false,
    });
    const [activityLogs, setActivityLogs] = useState<ActivityLogResponse | null>(null);
    const { data: modelsList } = useAIModelsList();
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showKeysInfo, setShowKeysInfo] = useState(false);
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const [tutorConfig, setTutorConfig] = useState<TutorConfiguration>({
        enable: false,
        role: 'Tutor',
        assistant_name: 'Savir',
        institute_name: instituteDetails?.institute_name || 'Vacademy',
        core_instruction: 'You are a helpful tutor assisting students with their doubts.',
        hard_rules: [
            'Never provide the final answer directly.',
            'Keep responses short and concise unless explaining a complex topic.',
        ],
        adherence_settings: {
            level: 'strict',
            temperature: 0.5,
        },
    });
    const [newHardRule, setNewHardRule] = useState('');
    const [aiCoursePrompt, setAiCoursePrompt] = useState('');
    const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
    const [isSavingAiPrompt, setIsSavingAiPrompt] = useState(false);
    const [isLoadingAiPrompt, setIsLoadingAiPrompt] = useState(false);

    // Video branding state
    const [videoBranding, setVideoBranding] = useState<VideoBrandingConfig>(DEFAULT_VIDEO_BRANDING);
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [isLoadingBranding, setIsLoadingBranding] = useState(false);

    // Video style state
    const [videoStyle, setVideoStyle] = useState<VideoStyleConfig>(DEFAULT_VIDEO_STYLE);
    const [isSavingStyle, setIsSavingStyle] = useState(false);
    const [isLoadingStyle, setIsLoadingStyle] = useState(false);

    // Template gallery state
    const [videoTemplates, setVideoTemplates] = useState<VideoTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    const instituteId = getInstituteId();

    // Check if keys exist
    const checkKeys = useCallback(async () => {
        if (!instituteId) return;
        try {
            const response = await authenticatedAxiosInstance.get(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/institute/${instituteId}`
            );
            setKeysStatus({
                hasKeys: true,
                hasOpenAI: response.data.has_openai_key || false,
                hasGemini: response.data.has_gemini_key || false,
                defaultModel: response.data.default_model,
                isActive: response.data.is_active,
            });
            if (response.data.default_model) {
                setDefaultModel(response.data.default_model);
            }
            if (response.data.tutor_configuration) {
                setTutorConfig(response.data.tutor_configuration);
            }
        } catch (error: any) {
            if (error.response?.status === 404) {
                setKeysStatus({
                    hasKeys: false,
                    hasOpenAI: false,
                    hasGemini: false,
                });
            } else {
                console.error('Error checking keys:', error);
            }
        }
    }, [instituteId]);

    // Fetch activity logs
    const fetchActivityLogs = useCallback(
        async (page: number = 1) => {
            if (!instituteId) return;
            setIsLoadingLogs(true);
            try {
                const response = await authenticatedAxiosInstance.get<ActivityLogResponse>(
                    `${AI_SERVICE_BASE_URL}/token-usage/v1/institute/${instituteId}/activity-log`,
                    {
                        params: {
                            page: page,
                            page_size: pageSize,
                        },
                    }
                );
                setActivityLogs(response.data);
            } catch (error) {
                console.error('Error fetching activity logs:', error);
            } finally {
                setIsLoadingLogs(false);
            }
        },
        [instituteId, pageSize]
    );

    // Fetch tutor settings
    const fetchTutorSettings = useCallback(async () => {
        if (!instituteId) return;
        try {
            const response = await authenticatedAxiosInstance.get(GET_INSITITUTE_SETTINGS, {
                params: {
                    instituteId,
                    settingKey: 'CHATBOT_SETTING',
                },
            });
            if (response.data && response.data.data) {
                setTutorConfig((prev) => ({
                    ...prev,
                    ...response.data.data,
                }));
            }
        } catch (error) {
            console.error('Error fetching tutor settings:', error);
        }
    }, [instituteId]);

    // Fetch Institute AI Settings
    const fetchInstituteAiSettings = useCallback(async () => {
        if (!instituteId) return;
        setIsLoadingAiPrompt(true);
        try {
            const response = await authenticatedAxiosInstance.get(
                GET_INSTITUTE_AI_SETTINGS(instituteId)
            );
            if (response.data) {
                setAiCoursePrompt(response.data.ai_settings?.AI_COURSE_PROMPT || '');
                setHasCustomPrompt(response.data.has_custom_prompt || false);
            }
        } catch (error: any) {
            if (error.response?.status === 404) {
                // Institute not found or no settings - set defaults
                setAiCoursePrompt('');
                setHasCustomPrompt(false);
            } else {
                console.error('Error fetching institute AI settings:', error);
            }
        } finally {
            setIsLoadingAiPrompt(false);
        }
    }, [instituteId]);

    // Fetch Video Branding
    const fetchVideoBranding = useCallback(async () => {
        if (!instituteId) return;
        setIsLoadingBranding(true);
        try {
            const response = await authenticatedAxiosInstance.get(GET_VIDEO_BRANDING(instituteId));
            if (response.data?.branding) {
                setVideoBranding({
                    intro: { ...DEFAULT_VIDEO_BRANDING.intro, ...response.data.branding.intro },
                    outro: { ...DEFAULT_VIDEO_BRANDING.outro, ...response.data.branding.outro },
                    watermark: { ...DEFAULT_VIDEO_BRANDING.watermark, ...response.data.branding.watermark },
                });
            }
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching video branding:', error);
            }
        } finally {
            setIsLoadingBranding(false);
        }
    }, [instituteId]);

    // Save Video Branding
    const HTML_SIZE_WARN_BYTES = 50 * 1024; // 50KB

    const handleSaveVideoBranding = async () => {
        if (!instituteId) return;

        // Warn about large HTML that may cause render timeouts
        const fields = [
            { name: 'Intro', html: videoBranding.intro.html },
            { name: 'Outro', html: videoBranding.outro.html },
            { name: 'Watermark', html: videoBranding.watermark.html },
        ];
        for (const f of fields) {
            if (f.html && new Blob([f.html]).size > HTML_SIZE_WARN_BYTES) {
                toast.warning(
                    `${f.name} HTML is large (>${Math.round(HTML_SIZE_WARN_BYTES / 1024)}KB). Consider using external URLs instead of embedded images to avoid render timeouts.`
                );
            }
        }

        setIsSavingBranding(true);
        try {
            await authenticatedAxiosInstance.post(UPDATE_VIDEO_BRANDING(instituteId), {
                branding: videoBranding,
            });
            toast.success('Video branding saved successfully!');
        } catch (error) {
            console.error('Error saving video branding:', error);
            toast.error('Failed to save video branding');
        } finally {
            setIsSavingBranding(false);
        }
    };

    // Fetch Video Style
    const fetchVideoStyle = useCallback(async () => {
        if (!instituteId) return;
        setIsLoadingStyle(true);
        try {
            const response = await authenticatedAxiosInstance.get(GET_VIDEO_STYLE(instituteId));
            if (response.data?.style) {
                setVideoStyle({ ...DEFAULT_VIDEO_STYLE, ...response.data.style });
            }
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching video style:', error);
            }
        } finally {
            setIsLoadingStyle(false);
        }
    }, [instituteId]);

    const fetchVideoTemplates = useCallback(async () => {
        setIsLoadingTemplates(true);
        try {
            const response = await authenticatedAxiosInstance.get(GET_VIDEO_TEMPLATES());
            setVideoTemplates(response.data?.templates ?? []);
        } catch (error) {
            console.error('Error fetching video templates:', error);
        } finally {
            setIsLoadingTemplates(false);
        }
    }, []);

    // Save Video Style
    const handleSaveVideoStyle = async () => {
        if (!instituteId) return;
        setIsSavingStyle(true);
        try {
            await authenticatedAxiosInstance.post(UPDATE_VIDEO_STYLE(instituteId), {
                style: videoStyle,
            });
            toast.success('Video style saved successfully!');
        } catch (error) {
            console.error('Error saving video style:', error);
            toast.error('Failed to save video style');
        } finally {
            setIsSavingStyle(false);
        }
    };

    // Update Institute AI Settings
    const handleSaveAiPrompt = async () => {
        if (!instituteId) return;
        setIsSavingAiPrompt(true);
        try {
            const response = await authenticatedAxiosInstance.post(
                UPDATE_INSTITUTE_AI_SETTINGS(instituteId),
                {
                    ai_settings: {
                        AI_COURSE_PROMPT: aiCoursePrompt.trim() || null,
                    },
                }
            );
            if (response.data) {
                setHasCustomPrompt(response.data.has_custom_prompt || false);
                toast.success('AI Course Prompt saved successfully!');
            }
        } catch (error: any) {
            console.error('Error updating institute AI settings:', error);
            if (error.response?.status === 404) {
                toast.error('Institute not found');
            } else {
                toast.error('Failed to save AI Course Prompt');
            }
        } finally {
            setIsSavingAiPrompt(false);
        }
    };

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            await Promise.all([
                checkKeys(),
                fetchTutorSettings(),
                fetchInstituteAiSettings(),
                fetchVideoBranding(),
                fetchVideoStyle(),
                fetchVideoTemplates(),
            ]);
            setIsLoading(false);
        };
        initialize();
    }, [checkKeys, fetchTutorSettings, fetchInstituteAiSettings, fetchVideoBranding, fetchVideoStyle, fetchVideoTemplates]);

    // Fetch activity logs when page changes
    useEffect(() => {
        if (instituteId) {
            fetchActivityLogs(currentPage);
        }
    }, [currentPage, instituteId, fetchActivityLogs]);

    // Update institute name when instituteDetails changes
    useEffect(() => {
        if (instituteDetails?.institute_name) {
            setTutorConfig((prev) => ({
                ...prev,
                institute_name: instituteDetails.institute_name || 'Vacademy',
            }));
        }
    }, [instituteDetails]);

    const handleSave = async () => {
        if (!instituteId) return;
        setIsSaving(true);
        try {
            await authenticatedAxiosInstance.post(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/institute/${instituteId}`,
                {
                    openai_key: openaiKey || undefined,
                    gemini_key: geminiKey || undefined,
                    default_model: defaultModel || undefined,
                }
            );
            toast.success('AI Settings saved successfully!');
            setOpenaiKey('');
            setGeminiKey('');
            await checkKeys();
        } catch (error) {
            console.error('Error saving AI keys:', error);
            toast.error('Failed to save AI keys');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTutorConfig = async () => {
        if (!instituteId) return;
        setIsSavingTutor(true);
        try {
            await authenticatedAxiosInstance.post(
                `${BASE_URL}/admin-core-service/institute/setting/v1/save-setting`,
                {
                    setting_name: 'AI Chatbot Configuration',
                    setting_data: {
                        enable: tutorConfig.enable,
                        role: tutorConfig.role,
                        assistant_name: tutorConfig.assistant_name,
                        institute_name: tutorConfig.institute_name,
                        core_instruction: tutorConfig.core_instruction,
                        hard_rules: tutorConfig.hard_rules,
                        adherence_settings: {
                            level: tutorConfig.adherence_settings.level,
                            temperature: tutorConfig.adherence_settings.temperature,
                        },
                    },
                },
                {
                    params: {
                        instituteId: instituteId,
                        settingKey: 'CHATBOT_SETTING',
                    },
                }
            );
            toast.success('Student AI configuration saved successfully!');
            await checkKeys();
        } catch (error) {
            console.error('Error saving tutor configuration:', error);
            toast.error('Failed to save Student AI configuration');
        } finally {
            setIsSavingTutor(false);
        }
    };

    const handleDelete = async () => {
        if (!instituteId) return;
        if (
            !confirm(
                'Are you sure you want to permanently delete these API keys? This action cannot be undone.'
            )
        )
            return;

        setIsDeleting(true);
        try {
            await authenticatedAxiosInstance.delete(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/institute/${instituteId}/delete`
            );
            toast.success('Keys deleted successfully');
            setKeysStatus({
                hasKeys: false,
                hasOpenAI: false,
                hasGemini: false,
            });
            setDefaultModel('');
        } catch (error: any) {
            console.error('Error deleting keys:', error);
            if (error.response?.status === 404) {
                toast.error('No keys found to delete');
            } else {
                toast.error('Failed to delete keys');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handlePartialSave = async (type: 'openai' | 'gemini') => {
        if (!instituteId) return;
        const payload: any = {};
        if (type === 'openai') payload.openai_key = openaiKey;
        else payload.gemini_key = geminiKey;

        try {
            await authenticatedAxiosInstance.post(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/institute/${instituteId}`,
                payload
            );
            toast.success(`${type === 'openai' ? 'OpenRouter' : 'Gemini'} key saved!`);
            if (type === 'openai') setOpenaiKey('');
            else setGeminiKey('');
            await checkKeys();
        } catch (error) {
            toast.error('Failed to save key');
        }
    };

    const handleDeleteKey = async (type: 'openai' | 'gemini') => {
        if (!instituteId) return;
        if (
            !confirm(
                `Are you sure you want to delete the ${type === 'openai' ? 'OpenRouter' : 'Gemini'} key?`
            )
        )
            return;

        try {
            // Delete all keys and re-add the one we want to keep
            await authenticatedAxiosInstance.delete(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/institute/${instituteId}/delete`
            );

            // Re-add the key we want to keep
            const payload: any = {};
            if (type === 'gemini' && keysStatus.hasGemini) {
                // If deleting openai, keep gemini (but we can't re-add without the key value)
                // So we just delete and let user re-add
            } else if (type === 'openai' && keysStatus.hasOpenAI) {
                // If deleting gemini, keep openai (but we can't re-add without the key value)
                // So we just delete and let user re-add
            }

            toast.success(`${type === 'openai' ? 'OpenRouter' : 'Gemini'} key deleted`);
            await checkKeys();
        } catch (error) {
            toast.error('Failed to delete key');
        }
    };

    // Calculate totals
    const totalTokens =
        activityLogs?.records?.reduce((sum, record) => sum + (record.total_tokens || 0), 0) || 0;
    const totalPrice =
        activityLogs?.records?.reduce((sum, record) => sum + (record.total_price || 0), 0) || 0;

    // Get unique models from activity logs
    const uniqueModels = Array.from(
        new Set(activityLogs?.records.map((record) => record.model) || [])
    );

    if (isLoading) {
        return (
            <div className={isTab ? 'p-0' : 'p-6'}>
                <div className="flex h-64 items-center justify-center">
                    <div className="size-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={isTab ? 'space-y-6 p-0' : 'space-y-6 p-6'}>
            {/* AI Configuration Card */}
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="border-b border-indigo-50 bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-500 p-2 text-white">
                            <Sparkles className="size-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">AI Configuration</CardTitle>
                            <CardDescription>
                                Configure your AI model providers and API keys
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label
                                htmlFor="openaiKey"
                                className="flex items-center gap-2 text-sm font-medium"
                            >
                                OpenRouter API Key
                                <ShieldCheck className="size-3.5 text-green-500" />
                                <button
                                    type="button"
                                    onClick={() => setShowKeysInfo(true)}
                                    className="text-indigo-500 hover:text-indigo-700"
                                >
                                    <Info className="size-4" />
                                </button>
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="openaiKey"
                                    type="password"
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="border-indigo-100 focus:border-indigo-300 focus:ring-indigo-100"
                                    disabled={keysStatus.hasOpenAI}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="default"
                                    onClick={() => handlePartialSave('openai')}
                                    disabled={!openaiKey || keysStatus.hasOpenAI}
                                    className="border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                    <Plus className="mr-1 size-4" />
                                    Add
                                </Button>
                                {keysStatus.hasOpenAI && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="default"
                                        onClick={() => handleDeleteKey('openai')}
                                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500">
                                {keysStatus.hasOpenAI
                                    ? "You've added your key. We'll use your keys for AI requests."
                                    : 'Enter your key so that your requests will use these keys.'}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="geminiKey"
                                className="flex items-center gap-2 text-sm font-medium"
                            >
                                Gemini API Key
                                <ShieldCheck className="size-3.5 text-green-500" />
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="geminiKey"
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="border-indigo-100 focus:border-indigo-300 focus:ring-indigo-100"
                                    disabled={keysStatus.hasGemini}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="default"
                                    onClick={() => handlePartialSave('gemini')}
                                    disabled={!geminiKey || keysStatus.hasGemini}
                                    className="border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                    <Plus className="mr-1 size-4" />
                                    Add
                                </Button>
                                {keysStatus.hasGemini && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="default"
                                        onClick={() => handleDeleteKey('gemini')}
                                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500">
                                {keysStatus.hasGemini
                                    ? "You've added your key. We'll use your keys for AI requests."
                                    : 'Enter your key so that your requests will use these keys.'}
                            </p>
                        </div>
                    </div>

                    {keysStatus.hasKeys && (
                        <div className="flex justify-end">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                                {isDeleting ? (
                                    <>
                                        <span className="mr-2 size-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></span>
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="mr-2 size-4" />
                                        Delete All Keys
                                    </>
                                )}
                            </MyButton>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="max-w-sm space-y-2">
                            <Label htmlFor="defaultModel" className="text-sm font-medium">
                                Default AI Model
                            </Label>
                            <Select value={defaultModel} onValueChange={setDefaultModel}>
                                <SelectTrigger
                                    id="defaultModel"
                                    className="border-indigo-100 focus:border-indigo-300"
                                >
                                    <SelectValue placeholder="System Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    {modelsList && modelsList.models.length > 0 ? (
                                        modelsList.models.map((model) => (
                                            <SelectItem key={model.model_id} value={model.model_id}>
                                                {model.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="openai/gpt-4o">
                                                GPT-4o (Recommended)
                                            </SelectItem>
                                            <SelectItem value="openai/gpt-4o-mini">
                                                GPT-4o Mini
                                            </SelectItem>
                                            <SelectItem value="google/gemini-1.5-pro">
                                                Gemini 1.5 Pro
                                            </SelectItem>
                                            <SelectItem value="google/gemini-1.5-flash">
                                                Gemini 1.5 Flash
                                            </SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-gray-500">
                                The default model used when "Auto" is selected during generation.
                            </p>
                        </div>
                    </div>

                    {/* Activity Logs Section */}
                    <div className="space-y-4">
                        <div className="border-t border-indigo-100 pt-6">
                            <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                                Activity Logs
                            </h3>

                            {/* Summary Cards */}
                            <div className="mb-6 grid grid-cols-2 gap-4">
                                <Card className="border-indigo-100">
                                    <CardContent className="pt-4">
                                        <div className="flex flex-col">
                                            <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                Total Tokens Used
                                            </span>
                                            <span className="text-2xl font-bold text-indigo-900">
                                                {totalTokens.toLocaleString()}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-indigo-100">
                                    <CardContent className="pt-4">
                                        <div className="flex flex-col">
                                            <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                                Total Price Incurred
                                            </span>
                                            <span className="text-2xl font-bold text-indigo-900">
                                                ${totalPrice.toFixed(4)}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Models List */}
                            {uniqueModels.length > 0 && (
                                <div className="mb-6">
                                    <Label className="mb-2 block text-sm font-medium">
                                        Models Used
                                    </Label>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueModels.map((modelId) => {
                                            const model = modelsList?.models.find(
                                                (m) => m.model_id === modelId
                                            );
                                            return (
                                                <span
                                                    key={modelId}
                                                    className="rounded-md bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700"
                                                >
                                                    {model?.name || modelId}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Activity Logs Table */}
                            {isLoadingLogs ? (
                                <div className="flex h-32 items-center justify-center">
                                    <div className="size-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                                </div>
                            ) : activityLogs && activityLogs.records.length > 0 ? (
                                <div className="overflow-hidden rounded-lg border border-indigo-100">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-indigo-50/50">
                                                <TableHead className="text-xs font-semibold">
                                                    Date
                                                </TableHead>
                                                <TableHead className="text-xs font-semibold">
                                                    Model
                                                </TableHead>
                                                <TableHead className="text-xs font-semibold">
                                                    Type
                                                </TableHead>
                                                <TableHead className="text-right text-xs font-semibold">
                                                    Tokens
                                                </TableHead>
                                                <TableHead className="text-right text-xs font-semibold">
                                                    Price
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {activityLogs.records.map((record) => {
                                                const model = modelsList?.models.find(
                                                    (m) => m.model_id === record.model
                                                );
                                                return (
                                                    <TableRow key={record.id}>
                                                        <TableCell className="text-xs">
                                                            {new Date(
                                                                record.created_at
                                                            ).toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {model?.name || record.model}
                                                        </TableCell>
                                                        <TableCell className="text-xs capitalize">
                                                            {record.request_type}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs">
                                                            {record.total_tokens.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs">
                                                            ${(record.total_price || 0).toFixed(4)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-gray-500">
                                    No activity logs found
                                </div>
                            )}

                            {/* Pagination */}
                            {activityLogs && activityLogs.total_pages > 1 && (
                                <div className="mt-6 flex items-center justify-between">
                                    <div className="text-sm text-gray-600">
                                        Showing page {activityLogs.page} of{' '}
                                        {activityLogs.total_pages} ({activityLogs.total_count} total
                                        records)
                                    </div>
                                    <Pagination>
                                        <PaginationContent>
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (currentPage > 1) {
                                                            setCurrentPage(currentPage - 1);
                                                        }
                                                    }}
                                                    className={
                                                        currentPage <= 1
                                                            ? 'pointer-events-none opacity-50'
                                                            : 'cursor-pointer'
                                                    }
                                                />
                                            </PaginationItem>

                                            {/* Page Numbers */}
                                            {(() => {
                                                const pages: React.ReactNode[] = [];
                                                const totalPages = activityLogs.total_pages;
                                                let lastPage = 0;

                                                for (
                                                    let pageNum = 1;
                                                    pageNum <= totalPages;
                                                    pageNum++
                                                ) {
                                                    // Show first page, last page, current page, and pages around current
                                                    const showPage =
                                                        pageNum === 1 ||
                                                        pageNum === totalPages ||
                                                        (pageNum >= currentPage - 1 &&
                                                            pageNum <= currentPage + 1);

                                                    if (showPage) {
                                                        // Add ellipsis if there's a gap
                                                        if (pageNum - lastPage > 1) {
                                                            pages.push(
                                                                <PaginationItem
                                                                    key={`ellipsis-${lastPage + 1}`}
                                                                >
                                                                    <PaginationEllipsis />
                                                                </PaginationItem>
                                                            );
                                                        }

                                                        pages.push(
                                                            <PaginationItem key={pageNum}>
                                                                <PaginationLink
                                                                    href="#"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setCurrentPage(pageNum);
                                                                    }}
                                                                    isActive={
                                                                        currentPage === pageNum
                                                                    }
                                                                    className="cursor-pointer"
                                                                >
                                                                    {pageNum}
                                                                </PaginationLink>
                                                            </PaginationItem>
                                                        );
                                                        lastPage = pageNum;
                                                    }
                                                }

                                                return pages;
                                            })()}

                                            <PaginationItem>
                                                <PaginationNext
                                                    href="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (
                                                            currentPage < activityLogs.total_pages
                                                        ) {
                                                            setCurrentPage(currentPage + 1);
                                                        }
                                                    }}
                                                    className={
                                                        currentPage >= activityLogs.total_pages
                                                            ? 'pointer-events-none opacity-50'
                                                            : 'cursor-pointer'
                                                    }
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-amber-100 p-1 text-amber-600">
                                <ShieldCheck className="size-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-amber-900">
                                    Security Note
                                </h4>
                                <p className="mt-1 text-xs text-amber-700">
                                    Your API keys are stored securely and used only for AI-powered
                                    course generation. Never share your API keys with anyone.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <MyButton
                            disabled={isSaving}
                            onClick={handleSave}
                            className="min-w-[120px] bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            {isSaving ? (
                                <>
                                    <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 size-4" />
                                    Save Keys
                                </>
                            )}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {/* Student AI Configuration Card */}
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="border-b border-indigo-50 bg-indigo-50/30">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-indigo-500 p-2 text-white">
                                <Sparkles className="size-5" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Student AI</CardTitle>
                                <CardDescription>
                                    Configure AI tutor behavior and settings for student
                                    interactions
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="role" className="text-sm font-medium">
                                Enable
                            </Label>
                            <Switch
                                id="enable"
                                checked={tutorConfig.enable}
                                onCheckedChange={(e) =>
                                    setTutorConfig({
                                        ...tutorConfig,
                                        enable: e,
                                    })
                                }
                            />
                        </div>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-sm font-medium">
                                    Role
                                </Label>
                                <Input
                                    id="role"
                                    value={tutorConfig.role}
                                    onChange={(e) =>
                                        setTutorConfig({
                                            ...tutorConfig,
                                            role: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., Tutor, Mentor, Guide"
                                    className="border-indigo-100 focus:border-indigo-300"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assistantName" className="text-sm font-medium">
                                    Assistant Name
                                </Label>
                                <Input
                                    id="assistantName"
                                    value={tutorConfig.assistant_name}
                                    onChange={(e) =>
                                        setTutorConfig({
                                            ...tutorConfig,
                                            assistant_name: e.target.value,
                                        })
                                    }
                                    placeholder="e.g., Savir, Alex"
                                    className="border-indigo-100 focus:border-indigo-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="instituteName" className="text-sm font-medium">
                                Institute Name
                            </Label>
                            <Input
                                id="instituteName"
                                value={tutorConfig.institute_name}
                                onChange={(e) =>
                                    setTutorConfig({
                                        ...tutorConfig,
                                        institute_name: e.target.value,
                                    })
                                }
                                className="border-indigo-100 focus:border-indigo-300"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="coreInstruction" className="text-sm font-medium">
                                Core Instruction
                            </Label>
                            <textarea
                                id="coreInstruction"
                                value={tutorConfig.core_instruction}
                                onChange={(e) =>
                                    setTutorConfig({
                                        ...tutorConfig,
                                        core_instruction: e.target.value,
                                    })
                                }
                                placeholder="Define the core behavior of your AI tutor..."
                                rows={3}
                                className="w-full rounded-md border border-indigo-100 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Hard Rules</Label>
                            <div className="space-y-2">
                                {tutorConfig.hard_rules.map((rule, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Input
                                            value={rule}
                                            onChange={(e) => {
                                                const newRules = [...tutorConfig.hard_rules];
                                                newRules[index] = e.target.value;
                                                setTutorConfig({
                                                    ...tutorConfig,
                                                    hard_rules: newRules,
                                                });
                                            }}
                                            className="border-indigo-100 focus:border-indigo-300"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => {
                                                const newRules = tutorConfig.hard_rules.filter(
                                                    (_, i) => i !== index
                                                );
                                                setTutorConfig({
                                                    ...tutorConfig,
                                                    hard_rules: newRules,
                                                });
                                            }}
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <Input
                                        value={newHardRule}
                                        onChange={(e) => setNewHardRule(e.target.value)}
                                        placeholder="Add a new hard rule..."
                                        className="border-indigo-100 focus:border-indigo-300"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && newHardRule.trim()) {
                                                setTutorConfig({
                                                    ...tutorConfig,
                                                    hard_rules: [
                                                        ...tutorConfig.hard_rules,
                                                        newHardRule.trim(),
                                                    ],
                                                });
                                                setNewHardRule('');
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            if (newHardRule.trim()) {
                                                setTutorConfig({
                                                    ...tutorConfig,
                                                    hard_rules: [
                                                        ...tutorConfig.hard_rules,
                                                        newHardRule.trim(),
                                                    ],
                                                });
                                                setNewHardRule('');
                                            }
                                        }}
                                        className="border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                                    >
                                        <Plus className="mr-1 size-4" />
                                        Add
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="adherenceLevel" className="text-sm font-medium">
                                    Adherence Level
                                </Label>
                                <Select
                                    value={tutorConfig.adherence_settings.level}
                                    onValueChange={(value: 'strict' | 'moderate' | 'flexible') =>
                                        setTutorConfig({
                                            ...tutorConfig,
                                            adherence_settings: {
                                                ...tutorConfig.adherence_settings,
                                                level: value,
                                            },
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="adherenceLevel"
                                        className="border-indigo-100 focus:border-indigo-300"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="strict">Strict</SelectItem>
                                        <SelectItem value="moderate">Moderate</SelectItem>
                                        <SelectItem value="flexible">Flexible</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-gray-500">
                                    How strictly the AI follows the configured rules
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="temperature" className="text-sm font-medium">
                                    Temperature ({tutorConfig.adherence_settings.temperature})
                                </Label>
                                <input
                                    id="temperature"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={tutorConfig.adherence_settings.temperature}
                                    onChange={(e) =>
                                        setTutorConfig({
                                            ...tutorConfig,
                                            adherence_settings: {
                                                ...tutorConfig.adherence_settings,
                                                temperature: parseFloat(e.target.value),
                                            },
                                        })
                                    }
                                    className="w-full"
                                />
                                <p className="text-[10px] text-gray-500">
                                    Controls creativity (0 = focused, 1 = creative)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <MyButton
                            disabled={isSavingTutor}
                            onClick={handleSaveTutorConfig}
                            className="min-w-[120px] bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            {isSavingTutor ? (
                                <>
                                    <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 size-4" />
                                    Save Settings
                                </>
                            )}
                        </MyButton>
                    </div>
                </CardContent>
            </Card>

            {/* Institute AI Settings Card */}
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="border-b border-indigo-50 bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-500 p-2 text-white">
                            <Sparkles className="size-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Institute AI Course Prompt</CardTitle>
                            <CardDescription>
                                Configure custom AI prompt for course outline generation to align
                                with your institute's educational philosophy
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {isLoadingAiPrompt ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="aiCoursePrompt" className="text-sm font-medium">
                                    AI Course Prompt
                                </Label>
                                <textarea
                                    id="aiCoursePrompt"
                                    value={aiCoursePrompt}
                                    onChange={(e) => setAiCoursePrompt(e.target.value)}
                                    placeholder="Focus on practical, industry-relevant content with hands-on coding exercises and real-world applications. Emphasize problem-solving skills and modern development practices."
                                    rows={6}
                                    className="w-full rounded-md border border-indigo-100 px-3 py-2 text-sm focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                                />
                                <p className="text-[10px] text-gray-500">
                                    This prompt guides the AI when generating course outlines. Keep
                                    it concise but descriptive (recommended: 50-200 words). Leave
                                    empty to use default system prompt.
                                </p>
                                {hasCustomPrompt && (
                                    <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2">
                                        <ShieldCheck className="size-4 text-green-600" />
                                        <span className="text-xs text-green-700">
                                            Custom prompt is active
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-full bg-blue-100 p-1 text-blue-600">
                                        <Info className="size-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-blue-900">
                                            Best Practices
                                        </h4>
                                        <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-blue-700">
                                            <li>Be specific about course structure preferences</li>
                                            <li>Mention learning objectives and outcomes</li>
                                            <li>Include preferred teaching methodologies</li>
                                            <li>Specify any industry standards or frameworks</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <MyButton
                                    disabled={isSavingAiPrompt}
                                    onClick={handleSaveAiPrompt}
                                    className="min-w-[120px] bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {isSavingAiPrompt ? (
                                        <>
                                            <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 size-4" />
                                            Save Prompt
                                        </>
                                    )}
                                </MyButton>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* VIDEO BRANDING CARD                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="border-b border-indigo-50 bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-500 p-2 text-white">
                            <Film className="size-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Video Branding</CardTitle>
                            <CardDescription>
                                Custom intro, outro, and watermark HTML shown in generated videos
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {isLoadingBranding ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                        </div>
                    ) : (
                        <>
                            {/* ── Intro ────────────────────────────────── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">Intro Slide</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                            {videoBranding.intro.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <Switch
                                            checked={videoBranding.intro.enabled}
                                            onCheckedChange={(v) =>
                                                setVideoBranding((b) => ({
                                                    ...b,
                                                    intro: { ...b.intro, enabled: v },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                {videoBranding.intro.enabled && (
                                    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/20 p-4">
                                        <div className="flex items-center gap-4">
                                            <Label className="w-32 shrink-0 text-xs font-medium text-gray-600">
                                                Duration (seconds)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={10}
                                                step={0.5}
                                                value={videoBranding.intro.duration_seconds}
                                                onChange={(e) =>
                                                    setVideoBranding((b) => ({
                                                        ...b,
                                                        intro: {
                                                            ...b.intro,
                                                            duration_seconds: parseFloat(e.target.value) || 3,
                                                        },
                                                    }))
                                                }
                                                className="w-24 border-indigo-100 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    HTML (full 1920×1080 canvas)
                                                </Label>
                                                <textarea
                                                    value={videoBranding.intro.html}
                                                    onChange={(e) =>
                                                        setVideoBranding((b) => ({
                                                            ...b,
                                                            intro: { ...b.intro, html: e.target.value },
                                                        }))
                                                    }
                                                    rows={6}
                                                    placeholder="<div style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#fff;'><h1>Your Brand</h1></div>"
                                                    className="w-full rounded-md border border-indigo-100 px-3 py-2 font-mono text-xs focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                                                />
                                                <p className={`text-[10px] ${videoBranding.intro.html.length > HTML_SIZE_WARN_BYTES ? 'text-amber-500' : 'text-gray-400'}`}>
                                                    {(videoBranding.intro.html.length / 1024).toFixed(1)}KB
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Live Preview (scaled)
                                                </Label>
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        aspectRatio: '16/9',
                                                        maxWidth: '320px',
                                                        height: '180px',
                                                        overflow: 'hidden',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e5e7eb',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    <iframe
                                                        srcDoc={videoBranding.intro.html || '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f9fafb;color:#9ca3af;font-family:sans-serif;font-size:12px">Intro preview</div>'}
                                                        style={{
                                                            width: '1920px',
                                                            height: '1080px',
                                                            border: 'none',
                                                            transformOrigin: 'top left',
                                                            transform: 'scale(0.1667)',
                                                            pointerEvents: 'none',
                                                        }}
                                                        sandbox="allow-scripts"
                                                        title="Intro preview"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-indigo-50" />

                            {/* ── Outro ────────────────────────────────── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">Outro Slide</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                            {videoBranding.outro.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <Switch
                                            checked={videoBranding.outro.enabled}
                                            onCheckedChange={(v) =>
                                                setVideoBranding((b) => ({
                                                    ...b,
                                                    outro: { ...b.outro, enabled: v },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                {videoBranding.outro.enabled && (
                                    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/20 p-4">
                                        <div className="flex items-center gap-4">
                                            <Label className="w-32 shrink-0 text-xs font-medium text-gray-600">
                                                Duration (seconds)
                                            </Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={10}
                                                step={0.5}
                                                value={videoBranding.outro.duration_seconds}
                                                onChange={(e) =>
                                                    setVideoBranding((b) => ({
                                                        ...b,
                                                        outro: {
                                                            ...b.outro,
                                                            duration_seconds: parseFloat(e.target.value) || 4,
                                                        },
                                                    }))
                                                }
                                                className="w-24 border-indigo-100 text-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    HTML (full 1920×1080 canvas)
                                                </Label>
                                                <textarea
                                                    value={videoBranding.outro.html}
                                                    onChange={(e) =>
                                                        setVideoBranding((b) => ({
                                                            ...b,
                                                            outro: { ...b.outro, html: e.target.value },
                                                        }))
                                                    }
                                                    rows={6}
                                                    placeholder="<div style='display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#fff;'><p>Thank you for watching</p></div>"
                                                    className="w-full rounded-md border border-indigo-100 px-3 py-2 font-mono text-xs focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                                                />
                                                <p className={`text-[10px] ${videoBranding.outro.html.length > HTML_SIZE_WARN_BYTES ? 'text-amber-500' : 'text-gray-400'}`}>
                                                    {(videoBranding.outro.html.length / 1024).toFixed(1)}KB
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Live Preview (scaled)
                                                </Label>
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        aspectRatio: '16/9',
                                                        maxWidth: '320px',
                                                        height: '180px',
                                                        overflow: 'hidden',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e5e7eb',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    <iframe
                                                        srcDoc={videoBranding.outro.html || '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#f9fafb;color:#9ca3af;font-family:sans-serif;font-size:12px">Outro preview</div>'}
                                                        style={{
                                                            width: '1920px',
                                                            height: '1080px',
                                                            border: 'none',
                                                            transformOrigin: 'top left',
                                                            transform: 'scale(0.1667)',
                                                            pointerEvents: 'none',
                                                        }}
                                                        sandbox="allow-scripts"
                                                        title="Outro preview"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-indigo-50" />

                            {/* ── Watermark ────────────────────────────── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">Watermark</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                            {videoBranding.watermark.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <Switch
                                            checked={videoBranding.watermark.enabled}
                                            onCheckedChange={(v) =>
                                                setVideoBranding((b) => ({
                                                    ...b,
                                                    watermark: { ...b.watermark, enabled: v },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                {videoBranding.watermark.enabled && (
                                    <div className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/20 p-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Position
                                                </Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {WATERMARK_POSITIONS.map((pos) => (
                                                        <button
                                                            key={pos.value}
                                                            type="button"
                                                            onClick={() =>
                                                                setVideoBranding((b) => ({
                                                                    ...b,
                                                                    watermark: {
                                                                        ...b.watermark,
                                                                        position: pos.value,
                                                                    },
                                                                }))
                                                            }
                                                            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                                                                videoBranding.watermark.position === pos.value
                                                                    ? 'border-indigo-400 bg-indigo-100 text-indigo-700'
                                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {pos.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Opacity ({videoBranding.watermark.opacity.toFixed(2)})
                                                </Label>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={1}
                                                    step={0.05}
                                                    value={videoBranding.watermark.opacity}
                                                    onChange={(e) =>
                                                        setVideoBranding((b) => ({
                                                            ...b,
                                                            watermark: {
                                                                ...b.watermark,
                                                                opacity: parseFloat(e.target.value),
                                                            },
                                                        }))
                                                    }
                                                    className="w-full"
                                                />
                                                <p className="text-[10px] text-gray-400">
                                                    0 = invisible · 1 = fully opaque
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Watermark HTML
                                                </Label>
                                                <textarea
                                                    value={videoBranding.watermark.html}
                                                    onChange={(e) =>
                                                        setVideoBranding((b) => ({
                                                            ...b,
                                                            watermark: { ...b.watermark, html: e.target.value },
                                                        }))
                                                    }
                                                    rows={3}
                                                    placeholder="<div style='font-family:sans-serif;color:rgba(0,0,0,0.3);font-size:14px;'>Your Brand</div>"
                                                    className="w-full rounded-md border border-indigo-100 px-3 py-2 font-mono text-xs focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                                                />
                                                <p className={`text-[10px] ${videoBranding.watermark.html.length > HTML_SIZE_WARN_BYTES ? 'text-amber-500' : 'text-gray-400'}`}>
                                                    {(videoBranding.watermark.html.length / 1024).toFixed(1)}KB
                                                </p>
                                                <p className="text-[10px] text-gray-500">
                                                    Small HTML snippet rendered in the corner of every frame.
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs font-medium text-gray-600">
                                                    Live Preview
                                                </Label>
                                                <div
                                                    style={{
                                                        width: '200px',
                                                        height: '120px',
                                                        overflow: 'hidden',
                                                        borderRadius: '6px',
                                                        border: '1px solid #e5e7eb',
                                                        position: 'relative',
                                                        background: '#f9fafb',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            ...(videoBranding.watermark.position?.includes('top')
                                                                ? { top: '8px' }
                                                                : { bottom: '8px' }),
                                                            ...(videoBranding.watermark.position?.includes('left')
                                                                ? { left: '8px' }
                                                                : { right: '8px' }),
                                                            opacity: videoBranding.watermark.opacity,
                                                        }}
                                                        dangerouslySetInnerHTML={{
                                                            __html:
                                                                videoBranding.watermark.html ||
                                                                '<span style="color:#9ca3af;font-family:sans-serif;font-size:10px">Watermark preview</span>',
                                                        }}
                                                    />
                                                    <span
                                                        className="text-[8px] text-gray-300"
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                        }}
                                                    >
                                                        {videoBranding.watermark.position?.replace('-', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end pt-2">
                                <MyButton
                                    disabled={isSavingBranding}
                                    onClick={handleSaveVideoBranding}
                                    className="min-w-[140px] bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {isSavingBranding ? (
                                        <>
                                            <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 size-4" />
                                            Save Branding
                                        </>
                                    )}
                                </MyButton>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* VIDEO STYLE CARD                                            */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Card className="border-indigo-100 shadow-sm">
                <CardHeader className="border-b border-indigo-50 bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-500 p-2 text-white">
                            <Palette className="size-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Video Style</CardTitle>
                            <CardDescription>
                                Choose a template for the overall look. Customize colors and fonts to override template defaults.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {isLoadingStyle ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                        </div>
                    ) : (
                        <>
                            {/* ── Background Theme ─────────────────────── */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Background Theme</Label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setVideoStyle((s) => ({ ...s, background_type: 'white' }))
                                        }
                                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                            videoStyle.background_type === 'white'
                                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className="size-3 rounded-full border border-gray-300 bg-white" />
                                        Light
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setVideoStyle((s) => ({ ...s, background_type: 'black' }))
                                        }
                                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                            videoStyle.background_type === 'black'
                                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className="size-3 rounded-full border border-gray-600 bg-gray-900" />
                                        Dark
                                    </button>
                                </div>
                            </div>

                            {/* ── Template Gallery ─────────────────────── */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Template Gallery</Label>
                                <p className="text-[10px] text-gray-500">
                                    Choose a visual template for your AI-generated video slides.
                                    Brand color and font overrides below apply on top.
                                </p>
                                {isLoadingTemplates ? (
                                    <p className="py-4 text-center text-sm text-gray-400">
                                        Loading templates…
                                    </p>
                                ) : videoTemplates.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-gray-400">
                                        No templates available.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {videoTemplates.map((template) => {
                                            const isSelected =
                                                videoStyle.layout_theme === template.id;
                                            return (
                                                <div
                                                    key={template.id}
                                                    onClick={() =>
                                                        setVideoStyle((s) => ({
                                                            ...s,
                                                            layout_theme: template.id,
                                                            background_type:
                                                                template.background_type,
                                                        }))
                                                    }
                                                    className={`cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                                                        isSelected
                                                            ? 'border-indigo-500 ring-2 ring-indigo-200'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    {/* iframe preview: 1920×1080 scaled to 240×135 */}
                                                    <div
                                                        style={{
                                                            width: '100%',
                                                            height: '135px',
                                                            overflow: 'hidden',
                                                            position: 'relative',
                                                            background: '#f3f4f6',
                                                        }}
                                                    >
                                                        <iframe
                                                            srcDoc={`<style>:root{--primary-color:${videoStyle.primary_color};--accent-color:${videoStyle.primary_color}}</style>${template.preview_html}`}
                                                            style={{
                                                                width: '1920px',
                                                                height: '1080px',
                                                                border: 'none',
                                                                transformOrigin: 'top left',
                                                                transform: 'scale(0.125)',
                                                                pointerEvents: 'none',
                                                            }}
                                                            sandbox="allow-scripts"
                                                            title={template.name}
                                                        />
                                                    </div>
                                                    <div className="bg-white px-2 py-1.5">
                                                        <p
                                                            className={`text-xs font-semibold ${
                                                                isSelected
                                                                    ? 'text-indigo-700'
                                                                    : 'text-gray-800'
                                                            }`}
                                                        >
                                                            {template.name}
                                                        </p>
                                                        <p className="truncate text-[10px] text-gray-400">
                                                            {template.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* ── Primary / Accent Color ───────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold">Primary / Accent Color</Label>
                                    {videoStyle.layout_theme && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setVideoStyle((s) => ({
                                                    ...s,
                                                    primary_color: DEFAULT_VIDEO_STYLE.primary_color,
                                                }))
                                            }
                                            className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline"
                                        >
                                            Reset to default
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-500">
                                    Overrides the template&apos;s default color. Used for headings, accents, chart colours, and annotations.
                                </p>
                                <div className="flex items-center gap-3">
                                    <ColorPicker
                                        value={videoStyle.primary_color}
                                        onChange={(color) =>
                                            setVideoStyle((s) => ({ ...s, primary_color: color }))
                                        }
                                    />
                                    <div
                                        className="size-8 rounded-full border border-gray-200 shadow-sm"
                                        style={{ background: videoStyle.primary_color }}
                                    />
                                    <span className="font-mono text-sm text-gray-600">
                                        {videoStyle.primary_color}
                                    </span>
                                </div>
                            </div>

                            <div className="border-t border-indigo-50" />

                            {/* ── Typography ───────────────────────────── */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Type className="size-4 text-indigo-500" />
                                    <Label className="text-sm font-semibold">Typography</Label>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-600">
                                            Heading Font
                                        </Label>
                                        <Select
                                            value={videoStyle.heading_font}
                                            onValueChange={(v) =>
                                                setVideoStyle((s) => ({ ...s, heading_font: v }))
                                            }
                                        >
                                            <SelectTrigger className="border-indigo-100 focus:border-indigo-300">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FONT_OPTIONS.map((f) => (
                                                    <SelectItem key={f} value={f}>
                                                        {f}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-600">
                                            Body Font
                                        </Label>
                                        <Select
                                            value={videoStyle.body_font}
                                            onValueChange={(v) =>
                                                setVideoStyle((s) => ({ ...s, body_font: v }))
                                            }
                                        >
                                            <SelectTrigger className="border-indigo-100 focus:border-indigo-300">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FONT_OPTIONS.map((f) => (
                                                    <SelectItem key={f} value={f}>
                                                        {f}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <MyButton
                                    disabled={isSavingStyle}
                                    onClick={handleSaveVideoStyle}
                                    className="min-w-[140px] bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                    {isSavingStyle ? (
                                        <>
                                            <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-2 size-4" />
                                            Save Style
                                        </>
                                    )}
                                </MyButton>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* API Keys Info Dialog */}
            <Dialog open={showKeysInfo} onOpenChange={setShowKeysInfo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="size-5 text-indigo-600" />
                            API Keys Information
                        </DialogTitle>
                        <DialogDescription>How to add and use API keys</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <h4 className="mb-2 text-sm font-semibold">
                                How to Get OpenRouter API Key
                            </h4>
                            <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
                                <li>
                                    Visit{' '}
                                    <a
                                        href="https://openrouter.ai"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                    >
                                        openrouter.ai
                                    </a>
                                </li>
                                <li>Sign up or log in to your account</li>
                                <li>Navigate to the "Keys" section in your dashboard</li>
                                <li>Click "Create Key" to generate a new API key</li>
                                <li>
                                    Copy the key (starts with "sk-") and paste it in the field above
                                </li>
                            </ol>
                        </div>
                        <div>
                            <h4 className="mb-2 text-sm font-semibold">
                                How to Get Gemini API Key
                            </h4>
                            <ol className="list-inside list-decimal space-y-2 text-sm text-gray-600">
                                <li>
                                    Visit{' '}
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                    >
                                        Google AI Studio
                                    </a>{' '}
                                    or{' '}
                                    <a
                                        href="https://console.cloud.google.com/apis/credentials"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                    >
                                        Google Cloud Console
                                    </a>
                                </li>
                                <li>Sign in with your Google account</li>
                                <li>Click "Create API Key" or "Get API Key"</li>
                                <li>Select or create a Google Cloud project (if prompted)</li>
                                <li>Copy the generated API key and paste it in the field above</li>
                            </ol>
                        </div>
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                            <p className="text-xs text-indigo-700">
                                <strong>Note:</strong> Your API keys are stored securely and only
                                used for AI-powered course generation. Never share your keys with
                                anyone.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowKeysInfo(false)}>
                            Got it
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AiSettings;
