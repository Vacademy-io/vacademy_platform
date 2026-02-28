import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavigate, createLazyFileRoute } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useState, useCallback, useEffect } from 'react';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { useSidebar } from '@/components/ui/sidebar';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { getCourseSettings } from '@/services/course-settings';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { toast } from 'sonner';
import {
    X,
    FileText,
    Sparkles,
    Link,
    AlertTriangle,
    Plus,
    Trash2,
    Info,
    Key,
    CheckCircle,
    BookOpen,
    Clock,
    Layers,
    Code,
    Video,
    HelpCircle,
    FileQuestion,
    Lightbulb,
    Upload,
    ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { scrapeUrlContent } from '@/services/aiCourseApi';
import { Loader2 } from 'lucide-react';
import { useAIModelsList } from '@/hooks/useAiModels';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

export const Route = createLazyFileRoute('/study-library/ai-copilot/')({
    component: RouteComponent,
});

const examplePrompts = [
    'Create a beginner-level Python Programming course for aspiring developers',
    'Design an end-to-end Machine Learning curriculum using Python and Scikit-Learn',
    'Build a Cloud Computing Fundamentals course covering AWS, Azure, and GCP basics',
    'Develop a Data Engineering course focusing on ETL pipelines and SQL concepts',
];

interface PrerequisiteFile {
    file: File;
    id: string;
}

interface PrerequisiteUrl {
    url: string;
    id: string;
    title?: string;
    content?: string;
}

// Bubble Button Component
const BubbleButton = ({
    icon: Icon,
    label,
    value,
    onClick,
    isActive = false,
    status,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value?: string;
    onClick: () => void;
    isActive?: boolean;
    status?: 'success' | 'warning' | 'default';
}) => {
    const statusColors = {
        success: 'border-green-300 bg-green-50 text-green-700',
        warning: 'border-amber-300 bg-amber-50 text-amber-700',
        default:
            'border-neutral-200 bg-white text-neutral-700 hover:border-indigo-300 hover:bg-indigo-50',
    };

    return (
        <motion.button
            type="button"
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition-all',
                isActive
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-700'
                    : statusColors[status || 'default']
            )}
        >
            <Icon className="size-3.5" />
            <span>{label}</span>
            {value && <span className="text-[10px] opacity-70">({value})</span>}
            {status === 'success' && <CheckCircle className="size-3 text-green-600" />}
        </motion.button>
    );
};

function RouteComponent() {
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();
    const { setOpen } = useSidebar();

    // Collapse sidebar on mount
    useEffect(() => {
        setOpen(false);
    }, [setOpen]);

    // Form state - keeping all existing state
    const [ageRange, setAgeRange] = useState('');
    const [skillLevel, setSkillLevel] = useState(''); // Now stores levelId
    const [language, setLanguage] = useState('English');
    const [prerequisiteFiles, setPrerequisiteFiles] = useState<PrerequisiteFile[]>([]);
    const [prerequisiteUrls, setPrerequisiteUrls] = useState<PrerequisiteUrl[]>([]);
    const [newPrerequisiteUrl, setNewPrerequisiteUrl] = useState('');
    const [courseGoal, setCourseGoal] = useState('');
    const [learningOutcome, setLearningOutcome] = useState('');
    const [includeDiagrams, setIncludeDiagrams] = useState(true);
    const [includeCodeSnippets, setIncludeCodeSnippets] = useState(false);
    const [includePracticeProblems, setIncludePracticeProblems] = useState(true);
    const [includeYouTubeVideo, setIncludeYouTubeVideo] = useState(true);
    const [includeAIGeneratedVideo, setIncludeAIGeneratedVideo] = useState(true);
    const [includeAISlides, setIncludeAISlides] = useState(false);
    const [includeAIStorybook, setIncludeAIStorybook] = useState(false);
    const [programmingLanguage, setProgrammingLanguage] = useState('');
    const [numberOfChapters, setNumberOfChapters] = useState('5');
    const [chapterLength, setChapterLength] = useState('60');
    const [customChapterLength, setCustomChapterLength] = useState('');
    const [includeQuizzes, setIncludeQuizzes] = useState(true);
    const [includeHomework, setIncludeHomework] = useState(false);
    const [includeSolutions, setIncludeSolutions] = useState(true);
    const [slidesPerChapter, setSlidesPerChapter] = useState('5');
    const [numberOfSubjects, setNumberOfSubjects] = useState('');
    const [numberOfModules, setNumberOfModules] = useState('');
    const [courseDepth, setCourseDepth] = useState<number>(3);
    const [referenceFiles, setReferenceFiles] = useState<PrerequisiteFile[]>([]);
    const [referenceUrls, setReferenceUrls] = useState<PrerequisiteUrl[]>([]);
    const [newReferenceUrl, setNewReferenceUrl] = useState('');
    const [selectedModel, setSelectedModel] = useState('auto');
    const [openaiKey, setOpenaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [usageData, setUsageData] = useState<any>(null);

    // ... (previous code)

    const [userKeysStatus, setUserKeysStatus] = useState<{
        hasKeys: boolean;
        hasOpenAI: boolean;
        hasGemini: boolean;
    }>({
        hasKeys: false,
        hasOpenAI: false,
        hasGemini: false,
    });

    const { data: modelsList, isLoading: isLoadingModels } = useAIModelsList();
    const [isScraping, setIsScraping] = useState(false);

    // Dialog states for bubbles
    const [showKeysDialog, setShowKeysDialog] = useState(false);
    const [showStructureDialog, setShowStructureDialog] = useState(false);
    const [showContentDialog, setShowContentDialog] = useState(false);
    const [showReferencesDialog, setShowReferencesDialog] = useState(false);
    const [viewingReference, setViewingReference] = useState<{
        title?: string;
        content?: string;
    } | null>(null);

    const instituteId = getInstituteId();
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const userId = tokenData?.user;

    // Get institute levels
    const instituteDetails = useInstituteDetailsStore((state) => state.instituteDetails);
    const instituteLevels = instituteDetails?.levels || [];

    // Set default level when levels are loaded
    useEffect(() => {
        const firstLevel = instituteLevels[0];
        if (firstLevel && !skillLevel) {
            setSkillLevel(firstLevel.id);
        }
    }, [instituteLevels, skillLevel]);

    // Check if user has API keys
    const checkUserKeys = useCallback(async () => {
        if (!userId) return;
        try {
            const url = new URL(`${AI_SERVICE_BASE_URL}/api-keys/v1/user/${userId}`);
            if (instituteId) {
                url.searchParams.append('institute_id', instituteId);
            }
            const response = await authenticatedAxiosInstance.get(url.toString());
            setUserKeysStatus({
                hasKeys: true,
                hasOpenAI: response.data.has_openai_key || false,
                hasGemini: response.data.has_gemini_key || false,
            });
        } catch (error: any) {
            if (error.response?.status === 404) {
                setUserKeysStatus({
                    hasKeys: false,
                    hasOpenAI: false,
                    hasGemini: false,
                });
            } else {
                console.error('Error checking user keys:', error);
            }
        }
    }, [userId, instituteId]);

    useEffect(() => {
        if (userId) {
            checkUserKeys();
        }
    }, [userId, checkUserKeys]);

    const fetchUsage = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await authenticatedAxiosInstance.get(
                `${AI_SERVICE_BASE_URL}/api-usage/v1/user/${userId}`,
                { params: { institute_id: instituteId } }
            );
            setUsageData(response.data);
        } catch (error) {
            console.error('Error fetching usage:', error);
        }
    }, [userId, instituteId]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    const handleSaveUserKey = async (type: 'openai' | 'gemini') => {
        if (!userId) return;
        const payload: any = {};
        if (type === 'openai') payload.openai_key = openaiKey;
        else payload.gemini_key = geminiKey;

        try {
            await authenticatedAxiosInstance.post(
                `${AI_SERVICE_BASE_URL}/api-keys/v1/user/${userId}`,
                payload,
                { params: { institute_id: instituteId } }
            );
            toast.success(`${type === 'openai' ? 'OpenRouter' : 'Gemini'} key saved!`);
            if (type === 'openai') setOpenaiKey('');
            else setGeminiKey('');
            await checkUserKeys();
            fetchUsage();
        } catch (error) {
            toast.error('Failed to save key');
        }
    };

    const handleDeleteUserKey = async (type: 'openai' | 'gemini') => {
        if (!userId) return;
        if (
            !confirm(
                `Are you sure you want to delete the ${type === 'openai' ? 'OpenRouter' : 'Gemini'} key ? `
            )
        )
            return;

        try {
            await authenticatedAxiosInstance.delete(
                `${AI_SERVICE_BASE_URL} /api-keys/v1 / user / ${userId}/delete`
            );
            toast.success(`${type === 'openai' ? 'OpenRouter' : 'Gemini'} key deleted`);
            await checkUserKeys();
        } catch (error: any) {
            console.error('Error deleting user key:', error);
            if (error.response?.status === 404) {
                toast.error('No keys found to delete');
            } else {
                toast.error('Failed to delete key');
            }
        }
    };

    useEffect(() => {
        setNavHeading('Create with Ai');
    }, [setNavHeading]);

    // Fetch course settings to get default course depth
    useEffect(() => {
        const fetchCourseDepth = async () => {
            try {
                const settings = await getCourseSettings();
                const defaultDepth = settings?.courseStructure?.defaultDepth || 3;
                setCourseDepth(defaultDepth);
            } catch (error) {
                console.error('Error fetching course settings:', error);
                setCourseDepth(3);
            }
        };
        fetchCourseDepth();
    }, []);

    const handleExamplePromptClick = (examplePrompt: string) => {
        setCourseGoal(examplePrompt);
    };

    const handleAddPrerequisiteUrl = () => {
        if (newPrerequisiteUrl.trim()) {
            setPrerequisiteUrls((prev) => [
                ...prev,
                { url: newPrerequisiteUrl.trim(), id: `${Date.now()}-${Math.random()}` },
            ]);
            setNewPrerequisiteUrl('');
        }
    };

    const handleRemovePrerequisiteUrl = (id: string) => {
        setPrerequisiteUrls((prev) => prev.filter((url) => url.id !== id));
    };

    const onPrerequisiteDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: any[]) => {
            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach((rejection) => {
                    if (rejection.errors) {
                        rejection.errors.forEach((error: any) => {
                            if (error.code === 'file-too-large') {
                                alert(
                                    `File "${rejection.file.name}" exceeds the maximum size of 512 MB`
                                );
                            } else if (error.code === 'file-invalid-type') {
                                alert(
                                    `File "${rejection.file.name}" is not a valid type. Only PDF, DOC, DOCX, CSV, and XLSX files are allowed.`
                                );
                            } else {
                                alert(`Error with file "${rejection.file.name}": ${error.message}`);
                            }
                        });
                    }
                });
            }

            const maxFileSize = 512 * 1024 * 1024;
            const validFiles = acceptedFiles.filter((file) => {
                if (file.size > maxFileSize) {
                    alert(`File "${file.name}" exceeds the maximum size of 512 MB`);
                    return false;
                }
                return true;
            });

            const currentFileCount = prerequisiteFiles.length;
            const newFileCount = validFiles.length;
            if (currentFileCount + newFileCount > 5) {
                const remainingSlots = 5 - currentFileCount;
                if (remainingSlots > 0) {
                    alert(
                        `You can only upload up to 5 files. ${remainingSlots} slot(s) remaining. Only the first ${remainingSlots} file(s) will be added.`
                    );
                    validFiles.splice(remainingSlots);
                } else {
                    alert(
                        'You have already reached the maximum limit of 5 files. Please remove some files before adding new ones.'
                    );
                    return;
                }
            }

            const newFiles: PrerequisiteFile[] = validFiles.map((file) => ({
                file,
                id: `${Date.now()}-${Math.random()}`,
            }));
            setPrerequisiteFiles((prev) => [...prev, ...newFiles]);
        },
        [prerequisiteFiles]
    );

    const {
        getRootProps: getPrerequisiteRootProps,
        getInputProps: getPrerequisiteInputProps,
        isDragActive: isPrerequisiteDragActive,
    } = useDropzone({
        onDrop: onPrerequisiteDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        multiple: true,
        maxSize: 512 * 1024 * 1024,
        maxFiles: 5,
    });

    const handleRemovePrerequisiteFile = (id: string) => {
        setPrerequisiteFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleAddReferenceUrl = async () => {
        if (newReferenceUrl.trim()) {
            const urlToAdd = newReferenceUrl.trim();
            setIsScraping(true);
            try {
                // Optimistically add to list with loading state
                const tempId = `${Date.now()}-${Math.random()}`;

                // Fetch content
                const data = await scrapeUrlContent(urlToAdd);

                setReferenceUrls((prev) => [
                    ...prev,
                    {
                        url: urlToAdd,
                        id: tempId,
                        title: data.title,
                        content: data.content,
                    },
                ]);
                toast.success('URL added and content fetched successfully');
            } catch (error) {
                console.error('Failed to scrape URL:', error);
                toast.error('Could not fetch URL content, but added as reference');
                // Add without content if scraping fails
                setReferenceUrls((prev) => [
                    ...prev,
                    { url: urlToAdd, id: `${Date.now()}-${Math.random()}` },
                ]);
            } finally {
                setIsScraping(false);
                setNewReferenceUrl('');
            }
        }
    };

    const handleRemoveReferenceUrl = (id: string) => {
        setReferenceUrls((prev) => prev.filter((url) => url.id !== id));
    };

    const onReferenceDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: any[]) => {
            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach((rejection) => {
                    if (rejection.errors) {
                        rejection.errors.forEach((error: any) => {
                            if (error.code === 'file-too-large') {
                                alert(
                                    `File "${rejection.file.name}" exceeds the maximum size of 512 MB`
                                );
                            } else if (error.code === 'file-invalid-type') {
                                alert(
                                    `File "${rejection.file.name}" is not a valid type. Only PDF, DOC, DOCX, CSV, and XLSX files are allowed.`
                                );
                            } else {
                                alert(`Error with file "${rejection.file.name}": ${error.message}`);
                            }
                        });
                    }
                });
            }

            const maxFileSize = 512 * 1024 * 1024;
            const validFiles = acceptedFiles.filter((file) => {
                if (file.size > maxFileSize) {
                    alert(`File "${file.name}" exceeds the maximum size of 512 MB`);
                    return false;
                }
                return true;
            });

            const currentFileCount = referenceFiles.length;
            const newFileCount = validFiles.length;
            if (currentFileCount + newFileCount > 5) {
                const remainingSlots = 5 - currentFileCount;
                if (remainingSlots > 0) {
                    alert(
                        `You can only upload up to 5 files. ${remainingSlots} slot(s) remaining. Only the first ${remainingSlots} file(s) will be added.`
                    );
                    validFiles.splice(remainingSlots);
                } else {
                    alert(
                        'You have already reached the maximum limit of 5 files. Please remove some files before adding new ones.'
                    );
                    return;
                }
            }

            const newFiles: PrerequisiteFile[] = validFiles.map((file) => ({
                file,
                id: `${Date.now()}-${Math.random()}`,
            }));
            setReferenceFiles((prev) => [...prev, ...newFiles]);
        },
        [referenceFiles]
    );

    const {
        getRootProps: getReferenceRootProps,
        getInputProps: getReferenceInputProps,
        isDragActive: isReferenceDragActive,
    } = useDropzone({
        onDrop: onReferenceDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        multiple: true,
        maxSize: 512 * 1024 * 1024,
        maxFiles: 5,
    });

    const handleRemoveReferenceFile = (id: string) => {
        setReferenceFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleSubmitCourseConfig = () => {
        if (!courseGoal.trim()) {
            alert('Please enter a course goal');
            return;
        }

        if (includeCodeSnippets && !programmingLanguage) {
            alert('Please select a programming language when code snippets are enabled');
            return;
        }

        setShowConfirmDialog(true);
    };

    const handleConfirmGenerate = () => {
        const finalCourseLength = chapterLength === 'custom' ? customChapterLength : chapterLength;

        // Prepare context from references
        let contextData = '';
        if (referenceUrls.some((u) => u.content)) {
            contextData += '\n\nREFERENCE MATERIALS:\n';
            referenceUrls.forEach((url, idx) => {
                if (url.content) {
                    contextData += `\n--- Source ${idx + 1}: ${url.title || url.url} ---\n${url.content}\n`;
                }
            });
        }

        const courseConfig = {
            prompt: courseGoal + contextData,
            learnerProfile: {
                ageRange: ageRange || undefined,
                skillLevel: skillLevel || undefined,
                prerequisiteFiles: prerequisiteFiles.map((f) => ({
                    name: f.file.name,
                    type: f.file.type,
                    size: f.file.size,
                })),
                prerequisiteUrls: prerequisiteUrls.map((u) => u.url),
            },
            courseGoal,
            learningOutcome: learningOutcome || undefined,
            courseDepthOptions: {
                includeDiagrams,
                includeCodeSnippets,
                includePracticeProblems,
                includeYouTubeVideo,
                includeAIGeneratedVideo,
                includeAISlides,
                includeAIStorybook,
                programmingLanguage: includeCodeSnippets ? programmingLanguage : undefined,
            },
            durationFormatStructure: {
                numberOfSessions: numberOfChapters ? parseInt(numberOfChapters) : undefined,
                sessionLength: finalCourseLength || undefined,
                includeQuizzes,
                includeHomework,
                includeSolutions,
                topicsPerSession: slidesPerChapter ? parseInt(slidesPerChapter) : undefined,
                numberOfSubjects: numberOfSubjects ? parseInt(numberOfSubjects) : undefined,
                numberOfModules: numberOfModules ? parseInt(numberOfModules) : undefined,
            },
            courseDepth: courseDepth,
            language: language || 'English',
            model: selectedModel,
            userId: userId,
            instituteId: instituteId,
            references: {
                files: referenceFiles.map((f) => ({
                    name: f.file.name,
                    type: f.file.type,
                    size: f.file.size,
                })),
                urls: referenceUrls.map((u) => u.url),
            },
        };

        console.log('Generating course with config:', courseConfig);
        sessionStorage.setItem('courseConfig', JSON.stringify(courseConfig));
        setShowConfirmDialog(false);
        navigate({
            to: '/study-library/ai-copilot/course-outline/generating',
        });
    };

    // Count active content options
    const activeContentOptions = [
        includeDiagrams,
        includeCodeSnippets,
        includePracticeProblems,
        includeYouTubeVideo,
        includeAIGeneratedVideo,
        includeAISlides,
        includeAIStorybook,
        includeQuizzes,
        includeHomework,
        includeSolutions,
    ].filter(Boolean).length;

    // Count references
    const totalReferences = referenceFiles.length + referenceUrls.length;

    return (
        <LayoutContainer>
            <Helmet>
                <title>Create Course with AI</title>
                <meta
                    name="description"
                    content="Create courses with AI assistance using natural language prompts."
                />
            </Helmet>
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-indigo-50 via-white to-purple-50 px-4">
                <div className="mx-auto w-full max-w-[800px]">
                    {/* Compact Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="mb-4 text-center"
                    >
                        <div className="mb-2 flex items-center justify-center gap-2">
                            <Sparkles className="size-6 text-indigo-500" />
                            <h1 className="text-2xl font-semibold text-neutral-900">
                                Create Course with AI
                            </h1>
                        </div>
                        <p className="text-sm text-gray-600">
                            Describe your course idea and let AI generate a complete learning
                            experience
                        </p>
                    </motion.div>

                    {/* Example Prompts - Compact */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="mb-3"
                    >
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {examplePrompts.map((prompt, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleExamplePromptClick(prompt)}
                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Main Form Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 }}
                        className="rounded-2xl border border-indigo-100/50 bg-white/80 p-5 shadow-lg shadow-indigo-100/50 backdrop-blur-sm"
                    >
                        {/* Course Goal Textarea */}
                        <div className="mb-4">
                            <Textarea
                                value={courseGoal}
                                onChange={(e) => setCourseGoal(e.target.value)}
                                placeholder="Describe your course goal... e.g., 'Create a comprehensive Python programming course for beginners covering basics to advanced topics'"
                                className="min-h-[100px] w-full resize-none border-neutral-200 focus:border-indigo-300 focus:ring-indigo-200"
                            />
                        </div>

                        {/* Bubbles Row 1 - Core Settings */}
                        <div className="mb-1">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                                Course Settings
                            </span>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2">
                            {/* Skill Level Dropdown */}
                            <Select value={skillLevel} onValueChange={setSkillLevel}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <Layers className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="Skill Level" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {instituteLevels.length > 0 ? (
                                        instituteLevels.map((level) => (
                                            <SelectItem key={level.id} value={level.id}>
                                                {level.level_name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="beginner">Beginner</SelectItem>
                                            <SelectItem value="intermediate">Intermediate</SelectItem>
                                            <SelectItem value="advanced">Advanced</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>

                            {/* Language Dropdown */}
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <BookOpen className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="Language" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Hindi">Hindi</SelectItem>
                                    <SelectItem value="Spanish">Spanish</SelectItem>
                                    <SelectItem value="French">French</SelectItem>
                                    <SelectItem value="Arabic">Arabic</SelectItem>
                                    <SelectItem value="Portuguese">Portuguese</SelectItem>
                                    <SelectItem value="German">German</SelectItem>
                                    <SelectItem value="Chinese">Chinese</SelectItem>
                                    <SelectItem value="Japanese">Japanese</SelectItem>
                                    <SelectItem value="Korean">Korean</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* AI Model Dropdown */}
                            <Select value={selectedModel} onValueChange={setSelectedModel}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="AI Model" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto (Smart)</SelectItem>
                                    {isLoadingModels ? (
                                        <div className="px-2 py-1.5 text-xs text-gray-500">
                                            Loading...
                                        </div>
                                    ) : modelsList && modelsList.models.length > 0 ? (
                                        modelsList.models.map((model) => (
                                            <SelectItem key={model.model_id} value={model.model_id}>
                                                {model.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
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

                            {/* Number of Chapters Dropdown */}
                            <Select value={numberOfChapters} onValueChange={setNumberOfChapters}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <BookOpen className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="Chapters" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map((num) => (
                                        <SelectItem key={num} value={num.toString()}>
                                            {num} Chapters
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="custom">Custom...</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Course Length Dropdown */}
                            <Select value={chapterLength} onValueChange={setChapterLength}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="Duration" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30">30 min</SelectItem>
                                    <SelectItem value="45">45 min</SelectItem>
                                    <SelectItem value="60">60 min</SelectItem>
                                    <SelectItem value="90">90 min</SelectItem>
                                    <SelectItem value="120">2 hours</SelectItem>
                                    <SelectItem value="custom">Custom...</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Slides per Chapter Dropdown */}
                            <Select value={slidesPerChapter} onValueChange={setSlidesPerChapter}>
                                <SelectTrigger className="h-8 w-auto rounded-full border-neutral-200 bg-white px-3 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <FileText className="size-3.5 text-neutral-500" />
                                        <SelectValue placeholder="Slides/Chapter" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {[3, 4, 5, 6, 7, 8, 10].map((num) => (
                                        <SelectItem key={num} value={num.toString()}>
                                            {num} Slides/Chapter
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Custom inputs for chapters/duration if needed */}
                        {(numberOfChapters === 'custom' || chapterLength === 'custom') && (
                            <div className="mb-3 flex gap-2">
                                {numberOfChapters === 'custom' && (
                                    <Input
                                        type="number"
                                        value={
                                            numberOfChapters === 'custom' ? '' : numberOfChapters
                                        }
                                        onChange={(e) => setNumberOfChapters(e.target.value)}
                                        placeholder="Enter number of chapters"
                                        className="h-8 w-40 text-xs"
                                    />
                                )}
                                {chapterLength === 'custom' && (
                                    <Input
                                        type="number"
                                        value={customChapterLength}
                                        onChange={(e) => setCustomChapterLength(e.target.value)}
                                        placeholder="Minutes"
                                        className="h-8 w-32 text-xs"
                                    />
                                )}
                            </div>
                        )}

                        {/* Bubbles Row 2 - Content Options & Actions */}
                        <div className="mb-1">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                                Additional Options
                            </span>
                        </div>
                        <div className="mb-4 flex flex-wrap gap-2">
                            {/* Content Options Bubble */}
                            <BubbleButton
                                icon={Lightbulb}
                                label="Content Options"
                                value={
                                    activeContentOptions > 0
                                        ? `${activeContentOptions} selected`
                                        : undefined
                                }
                                onClick={() => setShowContentDialog(true)}
                                isActive={activeContentOptions > 0}
                            />

                            {/* Structure Bubble (for depth-dependent options) */}
                            {courseDepth > 3 && (
                                <BubbleButton
                                    icon={Layers}
                                    label="Structure"
                                    value={
                                        numberOfModules || numberOfSubjects
                                            ? 'Configured'
                                            : undefined
                                    }
                                    onClick={() => setShowStructureDialog(true)}
                                    isActive={!!(numberOfModules || numberOfSubjects)}
                                />
                            )}

                            {/* References Bubble */}
                            <BubbleButton
                                icon={Link}
                                label="References"
                                value={totalReferences > 0 ? `${totalReferences}` : undefined}
                                onClick={() => setShowReferencesDialog(true)}
                                isActive={totalReferences > 0}
                            />

                            {/* API Keys Bubble */}
                            <BubbleButton
                                icon={Key}
                                label="API Keys"
                                onClick={() => setShowKeysDialog(true)}
                                status={
                                    userKeysStatus.hasOpenAI || userKeysStatus.hasGemini
                                        ? 'success'
                                        : 'default'
                                }
                            />
                        </div>

                        {/* Generate Button */}
                        <MyButton
                            buttonType="primary"
                            onClick={handleSubmitCourseConfig}
                            disabled={!courseGoal.trim()}
                            className="w-full shadow-lg shadow-indigo-200"
                        >
                            <Sparkles className="mr-2 size-4" />
                            Generate Course Outline
                        </MyButton>
                    </motion.div>
                </div>
            </div>

            {/* Content Options Dialog */}
            <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lightbulb className="size-5 text-indigo-600" />
                            Content Options
                        </DialogTitle>
                        <DialogDescription>Select what to include in your course</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeDiagrams}
                                    onCheckedChange={(checked) =>
                                        setIncludeDiagrams(checked === true)
                                    }
                                />
                                <span className="text-sm">Diagrams</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeCodeSnippets}
                                    onCheckedChange={(checked) =>
                                        setIncludeCodeSnippets(checked === true)
                                    }
                                />
                                <span className="text-sm">Code Snippets</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includePracticeProblems}
                                    onCheckedChange={(checked) =>
                                        setIncludePracticeProblems(checked === true)
                                    }
                                />
                                <span className="text-sm">Practice Problems</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeQuizzes}
                                    onCheckedChange={(checked) =>
                                        setIncludeQuizzes(checked === true)
                                    }
                                />
                                <span className="text-sm">Quizzes</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeHomework}
                                    onCheckedChange={(checked) =>
                                        setIncludeHomework(checked === true)
                                    }
                                />
                                <span className="text-sm">Assignments</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeSolutions}
                                    onCheckedChange={(checked) =>
                                        setIncludeSolutions(checked === true)
                                    }
                                />
                                <span className="text-sm">Solutions</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeYouTubeVideo}
                                    onCheckedChange={(checked) =>
                                        setIncludeYouTubeVideo(checked === true)
                                    }
                                />
                                <span className="text-sm">YouTube Videos</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeAIGeneratedVideo}
                                    onCheckedChange={(checked) =>
                                        setIncludeAIGeneratedVideo(checked === true)
                                    }
                                />
                                <span className="text-sm">AI Videos</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeAISlides}
                                    onCheckedChange={(checked) =>
                                        setIncludeAISlides(checked === true)
                                    }
                                />
                                <span className="text-sm">AI Slides</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={includeAIStorybook}
                                    onCheckedChange={(checked) =>
                                        setIncludeAIStorybook(checked === true)
                                    }
                                />
                                <span className="text-sm">AI Storybook</span>
                            </label>
                        </div>

                        {includeCodeSnippets && (
                            <div className="border-t pt-2">
                                <Label className="mb-2 block text-sm">Programming Language</Label>
                                <Select
                                    value={programmingLanguage}
                                    onValueChange={setProgrammingLanguage}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="python">Python</SelectItem>
                                        <SelectItem value="javascript">JavaScript</SelectItem>
                                        <SelectItem value="java">Java</SelectItem>
                                        <SelectItem value="cpp">C++</SelectItem>
                                        <SelectItem value="csharp">C#</SelectItem>
                                        <SelectItem value="go">Go</SelectItem>
                                        <SelectItem value="rust">Rust</SelectItem>
                                        <SelectItem value="typescript">TypeScript</SelectItem>
                                        <SelectItem value="php">PHP</SelectItem>
                                        <SelectItem value="ruby">Ruby</SelectItem>
                                        <SelectItem value="swift">Swift</SelectItem>
                                        <SelectItem value="kotlin">Kotlin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <MyButton buttonType="primary" onClick={() => setShowContentDialog(false)}>
                            Done
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Structure Dialog (for depth > 3) */}
            <Dialog open={showStructureDialog} onOpenChange={setShowStructureDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="size-5 text-indigo-600" />
                            Course Structure
                        </DialogTitle>
                        <DialogDescription>Configure advanced course hierarchy</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {courseDepth > 4 && (
                            <div>
                                <Label className="mb-2 block text-sm">Number of Subjects</Label>
                                <Select
                                    value={numberOfSubjects}
                                    onValueChange={setNumberOfSubjects}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select subjects" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[1, 2, 3, 4, 5, 6].map((num) => (
                                            <SelectItem key={num} value={num.toString()}>
                                                {num} Subject{num > 1 ? 's' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {courseDepth > 3 && (
                            <div>
                                <Label className="mb-2 block text-sm">Number of Modules</Label>
                                <Select value={numberOfModules} onValueChange={setNumberOfModules}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select modules" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[2, 3, 4, 5, 6, 8, 10].map((num) => (
                                            <SelectItem key={num} value={num.toString()}>
                                                {num} Modules
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <MyButton
                            buttonType="primary"
                            onClick={() => setShowStructureDialog(false)}
                        >
                            Done
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* References Dialog */}
            <Dialog open={showReferencesDialog} onOpenChange={setShowReferencesDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Link className="size-5 text-indigo-600" />
                            References
                        </DialogTitle>
                        <DialogDescription>
                            Add URLs or files for the AI to reference
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] space-y-4 overflow-y-auto py-4">
                        {/* URL Input */}
                        <div>
                            <Label className="mb-2 block text-sm">Add URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={newReferenceUrl}
                                    onChange={(e) => setNewReferenceUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddReferenceUrl();
                                        }
                                    }}
                                    placeholder="https://example.com"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleAddReferenceUrl}
                                    disabled={!newReferenceUrl.trim() || isScraping}
                                >
                                    {isScraping ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Plus className="size-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* URL List */}
                        {referenceUrls.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {referenceUrls.map((url) => (
                                    <div
                                        key={url.id}
                                        className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700"
                                    >
                                        <Link className="size-3.5" />
                                        <button
                                            type="button"
                                            className="max-w-[200px] truncate text-left hover:underline"
                                            onClick={() => {
                                                if (url.content) {
                                                    setViewingReference({
                                                        title: url.title || url.url,
                                                        content: url.content,
                                                    });
                                                }
                                            }}
                                            title={
                                                url.content
                                                    ? 'Click to view content'
                                                    : 'No content fetched'
                                            }
                                            disabled={!url.content}
                                        >
                                            {url.url}
                                        </button>
                                        {url.content && (
                                            <CheckCircle className="size-3 text-green-500" />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReferenceUrl(url.id)}
                                            className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-100"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* File Upload */}
                        <div>
                            <Label className="mb-2 block text-sm">Upload Files</Label>
                            <div
                                {...getReferenceRootProps()}
                                className={cn(
                                    'flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-all duration-200',
                                    isReferenceDragActive
                                        ? 'border-indigo-400 bg-indigo-50'
                                        : 'border-neutral-300 bg-neutral-50 hover:border-indigo-300'
                                )}
                            >
                                <input {...getReferenceInputProps()} />
                                <Upload className="size-5 text-neutral-400" />
                                <span className="text-xs text-neutral-500">
                                    Drop files or click (PDF, DOC, CSV, XLSX)
                                </span>
                            </div>
                        </div>

                        {/* File List */}
                        {referenceFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {referenceFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700"
                                    >
                                        <FileText className="size-3.5" />
                                        <span className="max-w-[150px] truncate">
                                            {file.file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReferenceFile(file.id)}
                                            className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-100"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <MyButton
                            buttonType="primary"
                            onClick={() => setShowReferencesDialog(false)}
                        >
                            Done
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Reference Content Dialog */}
            <Dialog
                open={!!viewingReference}
                onOpenChange={(open) => !open && setViewingReference(null)}
            >
                <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">
                            {viewingReference?.title || 'Reference Content'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border bg-neutral-50 p-4 font-mono text-sm">
                        {viewingReference?.content}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setViewingReference(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* API Keys Dialog */}
            <Dialog open={showKeysDialog} onOpenChange={setShowKeysDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="size-5 text-indigo-600" />
                            API Keys
                        </DialogTitle>
                        <DialogDescription>Add your API keys for AI generation</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* OpenRouter Key */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <Label className="text-sm">OpenRouter API Key</Label>
                                {userKeysStatus.hasOpenAI && (
                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle className="size-3" />
                                        Added
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    value={openaiKey}
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="flex-1"
                                    disabled={userKeysStatus.hasOpenAI}
                                    autoComplete="new-password"
                                />
                                {!userKeysStatus.hasOpenAI ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleSaveUserKey('openai')}
                                        disabled={!openaiKey}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleDeleteUserKey('openai')}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Gemini Key */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <Label className="text-sm">Gemini API Key</Label>
                                {userKeysStatus.hasGemini && (
                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle className="size-3" />
                                        Added
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    value={geminiKey}
                                    onChange={(e) => setGeminiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="flex-1"
                                    disabled={userKeysStatus.hasGemini}
                                    autoComplete="new-password"
                                />
                                {!userKeysStatus.hasGemini ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleSaveUserKey('gemini')}
                                        disabled={!geminiKey}
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleDeleteUserKey('gemini')}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                            <p className="text-xs text-indigo-700">
                                <strong>How to get keys:</strong> Visit{' '}
                                <a
                                    href="https://openrouter.ai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    openrouter.ai
                                </a>{' '}
                                or{' '}
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline"
                                >
                                    Google AI Studio
                                </a>
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <MyButton buttonType="primary" onClick={() => setShowKeysDialog(false)}>
                            Done
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="flex max-h-[90vh] w-[90vw] max-w-[900px] flex-col overflow-hidden p-0">
                    <DialogHeader className="shrink-0 border-b border-neutral-200 bg-white px-6 pb-4 pt-6">
                        <div className="mb-2 flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100">
                                <AlertTriangle className="size-5 text-amber-600" />
                            </div>
                            <DialogTitle className="text-xl font-semibold text-neutral-900">
                                Review Course Details
                            </DialogTitle>
                        </div>
                        <DialogDescription className="pt-2 text-sm text-neutral-600">
                            Please review your course configuration below. Once you proceed, you
                            won't be able to return and edit this information.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6">
                        <div className="space-y-4 py-4">
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                                    Course Goal
                                </h4>
                                <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
                                    {courseGoal || 'Not provided'}
                                </p>
                            </div>

                            {learningOutcome && (
                                <div>
                                    <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                                        Learning Outcome
                                    </h4>
                                    <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
                                        {learningOutcome}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                {skillLevel && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Skill Level
                                        </h4>
                                        <p className="text-sm capitalize text-neutral-600">
                                            {instituteLevels.find(l => l.id === skillLevel)?.level_name || skillLevel}
                                        </p>
                                    </div>
                                )}
                                {numberOfSubjects && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Number of Subjects
                                        </h4>
                                        <p className="text-sm text-neutral-600">
                                            {numberOfSubjects}
                                        </p>
                                    </div>
                                )}
                                {numberOfModules && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Number of Modules
                                        </h4>
                                        <p className="text-sm text-neutral-600">
                                            {numberOfModules}
                                        </p>
                                    </div>
                                )}
                                {numberOfChapters && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Number of Chapters
                                        </h4>
                                        <p className="text-sm text-neutral-600">
                                            {numberOfChapters}
                                        </p>
                                    </div>
                                )}
                                {(chapterLength || customChapterLength) && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Course Length
                                        </h4>
                                        <p className="text-sm text-neutral-600">
                                            {chapterLength === 'custom'
                                                ? `${customChapterLength} minutes`
                                                : chapterLength
                                                    ? `${chapterLength} minutes`
                                                    : ''}
                                        </p>
                                    </div>
                                )}
                                {slidesPerChapter && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                                            Slides per Chapter
                                        </h4>
                                        <p className="text-sm text-neutral-600">
                                            {slidesPerChapter}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {activeContentOptions > 0 && (
                                <div>
                                    <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                                        What to Include
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {includeDiagrams && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Diagrams
                                            </span>
                                        )}
                                        {includeCodeSnippets && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Code Snippets
                                                {programmingLanguage
                                                    ? ` (${programmingLanguage})`
                                                    : ''}
                                            </span>
                                        )}
                                        {includePracticeProblems && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Practice Problems
                                            </span>
                                        )}
                                        {includeQuizzes && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Quizzes
                                            </span>
                                        )}
                                        {includeHomework && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Assignments
                                            </span>
                                        )}
                                        {includeSolutions && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                Solutions
                                            </span>
                                        )}
                                        {includeYouTubeVideo && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                YouTube Video
                                            </span>
                                        )}
                                        {includeAIGeneratedVideo && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                AI Generated Video
                                            </span>
                                        )}
                                        {includeAISlides && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                AI Slides
                                            </span>
                                        )}
                                        {includeAIStorybook && (
                                            <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                                                AI Storybook
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {totalReferences > 0 && (
                                <div>
                                    <h4 className="mb-2 text-sm font-semibold text-neutral-900">
                                        References
                                    </h4>
                                    <div className="space-y-2">
                                        {referenceUrls.length > 0 && (
                                            <p className="text-sm text-neutral-600">
                                                <span className="font-medium">
                                                    {referenceUrls.length}
                                                </span>{' '}
                                                URL{referenceUrls.length !== 1 ? 's' : ''} added
                                            </p>
                                        )}
                                        {referenceFiles.length > 0 && (
                                            <p className="text-sm text-neutral-600">
                                                <span className="font-medium">
                                                    {referenceFiles.length}
                                                </span>{' '}
                                                file{referenceFiles.length !== 1 ? 's' : ''}{' '}
                                                uploaded
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-neutral-200 bg-white px-6 py-4">
                        <MyButton
                            buttonType="secondary"
                            onClick={() => setShowConfirmDialog(false)}
                        >
                            Go back and Edit
                        </MyButton>
                        <MyButton buttonType="primary" onClick={handleConfirmGenerate}>
                            Continue
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </LayoutContainer>
    );
}
