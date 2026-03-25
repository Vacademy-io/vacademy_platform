/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-warning-comments */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Send,
    BookOpen,
    FileText,
    Video,
    PenTool,
    Lightbulb,
    Target,
    Zap,
    Bot,
    User as UserIcon,
    Copy,
    Check,
    RefreshCw,
    Upload,
    Code,
    Image as ImageIcon,
    FileUp,
    X,
    Plus,
    Play,
    Edit3,
    FolderOpen,
    MessageCircle,
    AlertTriangle,
    Globe,
    ChevronRight,
    Search,
    Sparkles,
    Brain,
} from 'lucide-react';
import './styles/ChatView.css';
import { useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSidebar } from '@/components/ui/sidebar';
import TodoList from '../todo/TodoList';
import CourseStructureDisplay from './components/CourseStructureDisplay';
// Real API integration for streaming responses
import {
    sendChatMessageStreaming,
    type ChatApiRequest,
    type ChatApiResponse,
} from '@/services/aiCourseApi';
import type { Modification } from '../lib/applyModifications';
import type { TodoTask } from '@/services/aiResponseMemory';
import TodoProgress from './TodoProgress';
import { simulateStreamingResponse } from './simpleChatTest';
import type { ChatSection } from '../types';

interface UploadedFile {
    id: string;
    name: string;
    type: 'pdf' | 'video' | 'image';
    size: number;
    url: string;
    file: File;
}

interface CodePrompt {
    code: string;
    language: string;
    canEdit: boolean;
    canRun: boolean;
    description: string;
}

interface StructuredPrompt {
    type: 'code' | 'text';
    content: string;
    codePrompt?: CodePrompt;
}

interface Task {
    id: string;
    heading: string;
    completed: boolean;
    path?: string;
}

export interface Message {
    id: string;
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
    status: 'sending' | 'sent' | 'error' | 'streaming';
    attachments?: UploadedFile[];
    structuredPrompt?: StructuredPrompt;
    showTodoList?: boolean; // flag to display Todo list
}

interface PromptTemplate {
    id: string;
    title: string;
    description: string;
    prompt: string;
    category: 'course' | 'module' | 'assessment' | 'content';
    icon: React.ReactNode;
}

const MODEL_OPTIONS = [
    'google/gemini-2.5-flash-preview-05-20',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-r1-0528:free',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1-0528-qwen3-8b:free',
];

const PROMPT_TEMPLATES: PromptTemplate[] = [
    {
        id: 'basic-course',
        title: 'Create Basic Course',
        description: 'Generate a complete course structure with modules and lessons',
        prompt: 'Create a comprehensive course about [TOPIC] for [BEGINNER/INTERMEDIATE/ADVANCED] level learners. Include:\n- Course overview and objectives\n- 4-6 modules with detailed descriptions\n- Learning outcomes for each module\n- Estimated duration\n- Prerequisites',
        category: 'course',
        icon: <BookOpen className="size-4" />,
    },
    {
        id: 'interactive-content',
        title: 'Interactive Content',
        description: 'Generate engaging interactive lessons and activities',
        prompt: 'Create interactive content for [TOPIC] that includes:\n- Hands-on exercises and practical examples\n- Code challenges or real-world scenarios\n- Interactive quizzes and assessments\n- Visual aids and diagrams\n- Progressive difficulty levels',
        category: 'content',
        icon: <Zap className="size-4" />,
    },
    {
        id: 'assessment-generator',
        title: 'Assessment Generator',
        description: 'Create comprehensive assessments and quizzes',
        prompt: 'Generate a comprehensive assessment for [TOPIC] including:\n- 10 multiple choice questions\n- 5 short answer questions\n- 2 practical exercises\n- Answer key with explanations\n- Difficulty progression from basic to advanced',
        category: 'assessment',
        icon: <PenTool className="size-4" />,
    },
    {
        id: 'video-script',
        title: 'Video Script',
        description: 'Generate engaging video lesson scripts',
        prompt: 'Create a detailed video script for [TOPIC] that includes:\n- Engaging hook and introduction\n- Clear learning objectives\n- Step-by-step explanations with examples\n- Visual cues and demonstrations\n- Summary and call-to-action\n- Estimated duration: [TIME]',
        category: 'content',
        icon: <Video className="size-4" />,
    },
];

const EXAMPLE_PROMPTS = [
    'Create a Python programming course for complete beginners with hands-on projects',
    'Generate an advanced React course focusing on performance optimization and best practices',
    'Design a cybersecurity fundamentals course with practical labs and real-world scenarios',
    'Create a data science course using Python, including machine learning basics',
    'Build a comprehensive web development course covering HTML, CSS, JavaScript, and modern frameworks',
    'Design a digital marketing course with SEO, social media, and analytics modules',
];

const CONTEXT_OPTIONS = [
    {
        id: 'files-folders',
        title: 'Files & Folders',
        icon: <FolderOpen className="size-4" />,
        description: 'Add files and folders from your project',
    },
    {
        id: 'docs',
        title: 'Docs',
        icon: <FileText className="size-4" />,
        description: 'Reference documentation and guides',
    },
    {
        id: 'past-chats',
        title: 'Past Chats',
        icon: <MessageCircle className="size-4" />,
        description: 'Reference previous conversations',
    },
    {
        id: 'linter-errors',
        title: 'Linter Errors',
        icon: <AlertTriangle className="size-4" />,
        description: 'Show linting issues and errors',
    },
    {
        id: 'web',
        title: 'Web',
        icon: <Globe className="size-4" />,
        description: 'Search and include web content',
    },
];

interface ChatViewProps {
    onChatStart?: () => void;
    isFullScreen?: boolean;
    messages?: Message[];
    setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
    isLoading?: boolean;
    setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>;
    onModifications?: (mods: Modification[]) => void;
    onTodos?: (todos: TodoTask[]) => void;
    tasks?: Task[];

    // Todo progress integration
    onTaskClick?: (task: TodoTask) => void;
    onCourseGeneration?: () => void;

    // Debug props for streaming responses
    onStreamingDebug?: (chunk: string, fullResponse?: string) => void;

    // Message sections state management
    messageSections?: { [messageId: string]: ChatSection[] };
    setMessageSections?: React.Dispatch<
        React.SetStateAction<{ [messageId: string]: ChatSection[] }>
    >;
}

const ChatView: React.FC<ChatViewProps> = ({
    onChatStart,
    isFullScreen = false,
    messages: propMessages,
    setMessages: propSetMessages,
    isLoading: propIsLoading,
    setIsLoading: propSetIsLoading,
    onModifications,
    onTodos,
    tasks = [],
    onTaskClick,
    onCourseGeneration,
    onStreamingDebug,
    messageSections: propMessageSections,
    setMessageSections: propSetMessageSections,
}) => {
    const [prompt, setPrompt] = useState('');
    // Use local state as fallback if props not provided (for backward compatibility)
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const [localIsLoading, setLocalIsLoading] = useState(false);
    const [localMessageSections, setLocalMessageSections] = useState<{
        [messageId: string]: ChatSection[];
    }>({});

    // Debug flag for enabling enhanced logging - moved up for scoping
    const [isDebugMode, setIsDebugMode] = useState(false);

    // Render counter to track re-renders
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;

    // Debug state for streaming responses
    const [streamingResponse, setStreamingResponse] = useState('');
    const [allStreamChunks, setAllStreamChunks] = useState<string[]>([]);

    // Force re-render counter for debugging state updates
    const [forceRenderCounter, setForceRenderCounter] = useState(0);

    // Real-time streaming assembly state
    const [jsonBuffer, setJsonBuffer] = useState('');
    const [isAssemblingJson, setIsAssemblingJson] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<'thinking' | 'generating' | 'idle'>(
        'idle'
    );
    const [processedModifications, setProcessedModifications] = useState<Modification[]>([]);
    const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null);

    // Get current user data for avatar
    const { currentUser } = useCurrentUser();

    // Sidebar control for collapsing after intro
    const { setOpen: setSidebarOpen, open: sidebarOpen } = useSidebar();

    // Track sidebar state changes for debugging if needed
    // useEffect(() => {
    //     console.log('📊 Sidebar state from hook changed:', { sidebarOpen });
    // }, [sidebarOpen]);

    // Use props if provided, otherwise use local state
    const messages = propMessages ?? localMessages;
    const setMessages = propSetMessages ?? setLocalMessages;
    const isLoading = propIsLoading ?? localIsLoading;
    const setIsLoading = propSetIsLoading ?? setLocalIsLoading;
    const messageSections = propMessageSections ?? localMessageSections;
    const setMessageSections = propSetMessageSections ?? setLocalMessageSections;

    // Initialize cinematic intro based on messages - only show if no messages exist
    useEffect(() => {
        const hasMessages = messages.length > 0;
        setShowCinematicIntro(!hasMessages);

        if (isDebugMode) {
            console.log(
                `📺 ChatView (${isFullScreen ? 'FULLSCREEN' : 'SPLIT'}) - Messages updated:`,
                {
                    messageCount: messages.length,
                    propMessages: propMessages?.length || 'undefined',
                    localMessages: localMessages.length,
                    showingWelcome: !hasMessages,
                }
            );
        }
    }, [messages.length, isDebugMode, isFullScreen, propMessages?.length, localMessages.length]);

    // Monitor messageSections state changes
    useEffect(() => {
        if (isDebugMode) {
            const totalSections = Object.values(messageSections).reduce(
                (sum, sections) => sum + sections.length,
                0
            );
            console.log(`📊 MESSAGE SECTIONS STATE UPDATED:`, {
                messageIds: Object.keys(messageSections),
                totalSections,
                forceRenderCounter,
                sectionsDetail: Object.entries(messageSections).map(([id, sections]) => ({
                    messageId: id,
                    sectionCount: sections.length,
                    types: sections.map((s) => s.type),
                })),
            });
        }
    }, [messageSections, forceRenderCounter, isDebugMode]);

    // Real-time message content updates during streaming (now handled directly in processing)
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState<string>('');
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [inputMode, setInputMode] = useState<'text' | 'upload' | 'code'>('text');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [codePrompt, setCodePrompt] = useState<CodePrompt>({
        code: '',
        language: 'javascript',
        canEdit: true,
        canRun: false,
        description: '',
    });
    const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-pro');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const [showCodeDialog, setShowCodeDialog] = useState(false);

    const [showContextDialog, setShowContextDialog] = useState(false);
    const [contextSearchQuery, setContextSearchQuery] = useState('');
    const [selectedContextOptions, setSelectedContextOptions] = useState<string[]>([]);
    const [showScrollIndicator, setShowScrollIndicator] = useState(false);
    const [showCinematicIntro, setShowCinematicIntro] = useState(false);
    const [introPhase, setIntroPhase] = useState(0); // 0: initial, 1: logo, 2: text, 3: complete
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [hasCollapsedSidebar, setHasCollapsedSidebar] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatMessagesRef = useRef<HTMLDivElement>(null);

    // Check if user is at bottom of chat
    const isAtBottom = useCallback(() => {
        if (!chatMessagesRef.current) return true;

        const element = chatMessagesRef.current;
        const threshold = 100; // 100px threshold
        const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

        return distanceFromBottom <= threshold;
    }, []);

    // Only scroll to bottom if user is already at bottom
    const scrollToBottomIfAtBottom = useCallback(() => {
        if (isAtBottom()) {
            setTimeout(() => {
                if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            }, 50);
        }
    }, [isAtBottom]);

    // Always scroll to bottom (for new messages)
    const forceScrollToBottom = useCallback(() => {
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }, 50);
    }, []);

    // Reset textarea height to initial state
    const resetTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.setProperty('height', 'auto', 'important');
            const computedStyle = window.getComputedStyle(textareaRef.current);
            const minHeight = parseInt(computedStyle.minHeight) || 60;
            textareaRef.current.style.setProperty('height', `${minHeight}px`, 'important');
            textareaRef.current.style.setProperty('overflow-y', 'hidden', 'important');
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textarea = e.target;
        setPrompt(textarea.value);

        // Auto-resize textarea dynamically as user types
        textarea.style.setProperty('height', 'auto', 'important');
        const scrollHeight = textarea.scrollHeight;

        // Get CSS values for min and max height
        const computedStyle = window.getComputedStyle(textarea);
        const minHeight = parseInt(computedStyle.minHeight) || 60;
        const maxHeight = parseInt(computedStyle.maxHeight) || 300;

        // Set the height based on content, respecting min and max
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        textarea.style.setProperty('height', `${newHeight}px`, 'important');

        // If we're at max height, enable scrolling
        if (newHeight >= maxHeight) {
            textarea.style.setProperty('overflow-y', 'auto', 'important');
        } else {
            textarea.style.setProperty('overflow-y', 'hidden', 'important');
        }
    };

    // Track scroll position to show/hide scroll indicator
    useEffect(() => {
        const handleScroll = () => {
            const hasStreamingMessage = messages.some((msg) => msg.status === 'streaming');
            setShowScrollIndicator(hasStreamingMessage && !isAtBottom());
        };

        const element = chatMessagesRef.current;
        if (!element) {
            return; // no element yet – nothing to clean up
        }

        element.addEventListener('scroll', handleScroll);
        // Check initially
        handleScroll();

        return () => element.removeEventListener('scroll', handleScroll);
    }, [messages, isAtBottom]);

    // Smart scroll: only scroll if user is at bottom, force scroll for new messages
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];

        if (lastMessage?.type === 'user') {
            // Always scroll for new user messages
            forceScrollToBottom();
        } else if (lastMessage?.status === 'streaming') {
            // Fallback: if user is at bottom during streaming, keep pinned.
            scrollToBottomIfAtBottom();
        } else {
            // For completed AI messages, always scroll
            forceScrollToBottom();
        }
    }, [messages, scrollToBottomIfAtBottom, forceScrollToBottom]);

    // Cinematic intro timing
    useEffect(() => {
        if (!showCinematicIntro) return;

        const timers = [
            // Phase 1: Show logo after 500ms
            setTimeout(() => setIntroPhase(1), 500),
            // Phase 2: Show text after 1.5s
            setTimeout(() => setIntroPhase(2), 1500),
            // Phase 3: Complete intro after 3.5s
            setTimeout(() => setIntroPhase(3), 3500),
            // Hide intro after 4s
            setTimeout(() => setShowCinematicIntro(false), 4000),
        ];

        return () => timers.forEach((timer) => clearTimeout(timer));
    }, [showCinematicIntro]);

    // Initialize sidebar state for AI course creator - ONLY on mount
    useEffect(() => {
        setSidebarOpen(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array - only run on mount

    // Separate effect to handle sidebar collapse when intro ends
    useEffect(() => {
        if (showCinematicIntro || hasCollapsedSidebar) {
            return;
        }

        const collapseTimer = setTimeout(() => {
            setSidebarOpen(false);
            setSidebarCollapsed(true);
            setHasCollapsedSidebar(true); // Mark that we've handled the collapse AFTER it happens
            // Remove animation class after animation completes
            setTimeout(() => setSidebarCollapsed(false), 500);
        }, 500); // Small delay after intro ends

        return () => clearTimeout(collapseTimer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCinematicIntro, hasCollapsedSidebar]); // Only depend on these two state values

    // Set initial textarea height on mount
    useEffect(() => {
        console.log(`🚀 ChatView (${isFullScreen ? 'FULLSCREEN' : 'SPLIT'}) mounted:`, {
            propMessagesLength: propMessages?.length || 'undefined',
            localMessagesLength: localMessages.length,
            isLoading: isLoading,
            hasOnChatStart: !!onChatStart,
        });

        if (isDebugMode) {
            console.log('🔍 Debug mode:', isDebugMode);
            console.log('📦 Message sections state:', messageSections);
        }
        resetTextareaHeight();

        // Make test function available in console for debugging (only once)
        interface WindowWithTestApi extends Window {
            enableChatDebug?: () => void;
            disableChatDebug?: () => void;
            simulateLastResponse?: () => void;
        }
        const windowWithTestApi = window as WindowWithTestApi;

        if (typeof window !== 'undefined') {
            windowWithTestApi.enableChatDebug = () => {
                setIsDebugMode(true);
                console.log('🐛 Chat debug mode enabled');
            };
            windowWithTestApi.disableChatDebug = () => {
                setIsDebugMode(false);
                console.log('🐛 Chat debug mode disabled');
            };

            // Add direct state inspection
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).chatDebugTools = {
                getCurrentMessages: () => {
                    console.log(
                        `💬 ChatView (${isFullScreen ? 'FULLSCREEN' : 'SPLIT'}) Current messages:`,
                        messages.length
                    );
                    console.log('📋 Message sections:', messageSections);
                    console.log('🎯 Current streaming ID:', currentStreamingMessageId);
                    console.log('🔄 Is loading:', isLoading);
                    console.log('🔍 Using props or local state:', propMessages ? 'PROPS' : 'LOCAL');
                    console.log('🔍 PropMessages length:', propMessages?.length || 'N/A');
                    console.log('🔍 LocalMessages length:', localMessages.length);
                    return {
                        chatViewType: isFullScreen ? 'FULLSCREEN' : 'SPLIT',
                        messages,
                        messageSections,
                        currentStreamingMessageId,
                        isLoading,
                        propMessages,
                        localMessages,
                    };
                },
                testSimpleMessage: () => {
                    console.log('🧪 Testing simple message addition...');
                    console.log('🔍 Before - messages.length:', messages.length);
                    console.log(
                        '🔍 Before - using setMessages:',
                        setMessages === setLocalMessages ? 'LOCAL' : 'PROPS'
                    );

                    const testMsg = {
                        id: 'test-' + Date.now(),
                        type: 'user' as const,
                        content: 'Test message',
                        timestamp: new Date(),
                        status: 'sent' as const,
                    };

                    setMessages((prev) => {
                        console.log('🔍 setMessages callback - prev.length:', prev.length);
                        const newArray = [...prev, testMsg];
                        console.log('🔍 setMessages callback - new.length:', newArray.length);
                        return newArray;
                    });

                    console.log('✅ Test message added');

                    // Force a re-check after a brief delay
                    setTimeout(() => {
                        console.log('🔍 After 100ms - messages.length:', messages.length);
                    }, 100);
                },
                forceReRender: () => {
                    console.log('🔄 Forcing component re-render...');
                    // Force a state update that should trigger re-render
                    setIsDebugMode((prev) => !prev);
                    setTimeout(() => setIsDebugMode((prev) => !prev), 10);
                },
                hideWelcome: () => {
                    console.log('🙈 Hiding welcome overlay...');
                    setShowCinematicIntro(false);
                    // Force user message count by adding a dummy message if needed
                    if (messages.length === 0) {
                        setMessages([
                            {
                                id: 'dummy-user-' + Date.now(),
                                type: 'user',
                                content: 'Debug: Hide welcome',
                                timestamp: new Date(),
                                status: 'sent',
                            },
                        ]);
                    }
                },
            };
            windowWithTestApi.simulateLastResponse = () => {
                console.log('🎬 Simulate last response function removed');
                console.log('❌ No captured responses available');
                console.log('🧪 Using mock response instead...');
                if (currentStreamingMessageId) {
                    simulateStreamingResponse(
                        (chunk) => processStreamingChunkDirect(chunk, currentStreamingMessageId!),
                        () => console.log('✅ Mock simulation complete'),
                        50
                    );
                }
            };

            console.log('🔧 Debug tools available:');
            console.log('  - window.enableChatDebug() - Enable detailed logging');
            console.log('  - window.disableChatDebug() - Disable detailed logging');
            console.log('  - window.simulateLastResponse() - Replay last response');
            console.log('  - window.chatDebugTools.getCurrentMessages() - Inspect current state');
            console.log('  - window.chatDebugTools.testSimpleMessage() - Add test message');
            console.log('  - window.chatDebugTools.forceReRender() - Force component re-render');
            console.log('  - window.chatDebugTools.hideWelcome() - Hide welcome overlay');
            console.log('🌐 Dev server: http://localhost:5175');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Mount-only effect for setting up console debugging tools

    // Click outside handler for model dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modelDropdownRef.current &&
                !modelDropdownRef.current.contains(event.target as Node)
            ) {
                setShowModelDropdown(false);
            }
        };

        if (!showModelDropdown) {
            return; // dropdown closed – no listener needed
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showModelDropdown]);

    useEffect(() => {
        // Reset textarea height when prompt is cleared
        if (!prompt && textareaRef.current) {
            const isMobile = window.innerWidth <= 768;
            const minHeight = isMobile ? 36 : 40;
            textareaRef.current.style.height = `${minHeight}px`;
        }
    }, [prompt]);

    const handleSendMessage = async () => {
        if ((!prompt.trim() && uploadedFiles.length === 0 && inputMode === 'text') || isLoading) {
            return;
        }

        // If we're editing an existing message, send through edit handler
        if (editingMessageId) {
            handleEditSend();
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content:
                prompt ||
                (uploadedFiles.length > 0
                    ? `Uploaded ${uploadedFiles.length} file(s)`
                    : 'Code prompt'),
            timestamp: new Date(),
            status: 'sent',
            attachments: uploadedFiles.length > 0 ? [...uploadedFiles] : undefined,
            structuredPrompt:
                inputMode === 'code' ? { type: 'code', content: prompt, codePrompt } : undefined,
        };

        setMessages((prev) => {
            const newMessages = [...prev, userMessage];

            // Trigger chat start callback if this is the first message
            if (newMessages.length === 1 && onChatStart) {
                setTimeout(onChatStart, 100); // Small delay to ensure state update
            }
            return newMessages;
        });

        // Hide cinematic intro when first message is sent
        if (showCinematicIntro) {
            setShowCinematicIntro(false);
            setHasCollapsedSidebar(true); // Mark that we've handled the collapse via user action
            // Also collapse the sidebar immediately since user is interacting
            setSidebarOpen(false);
            setSidebarCollapsed(true);
            setTimeout(() => setSidebarCollapsed(false), 500);
        }
        setPrompt('');
        setUploadedFiles([]);
        setCodePrompt({
            code: '',
            language: 'javascript',
            canEdit: true,
            canRun: false,
            description: '',
        });
        setInputMode('text');
        resetTextareaHeight();
        setIsLoading(true);

        // Real streaming API integration
        try {
            // Create a placeholder message that will be updated as streaming progresses
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: '🔄 **Connecting to AI...**',
                timestamp: new Date(),
                status: 'sent',
            };

            if (isDebugMode) {
                console.log('Debug mode enabled for message:', aiMessage.id);
            }

            setMessages((prev) => [...prev, aiMessage]);

            // Track the streaming message for real-time updates
            const messageId = aiMessage.id;
            if (isDebugMode) {
                console.log('🎯 Setting currentStreamingMessageId:', messageId);
            }
            setCurrentStreamingMessageId(messageId);
            setJsonBuffer('');
            jsonBufferRef.current = ''; // Reset ref too
            setIsAssemblingJson(false);
            setProcessingStatus('idle');
            // Clear processed sections for new message
            setProcessedJsonSections(new Set());
            processedJsonSectionsRef.current.clear();
            lastJsonCreationTime.current = 0;

            // Response capture removed

            // Start streaming with message ID captured in closure
            await sendStreamingMessage(
                userMessage.content,
                userMessage.attachments,
                userMessage.structuredPrompt,
                messageId // Pass messageId directly
            );

            // Add completion message if no content was added
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMessage.id && !msg.content.trim()
                        ? { ...msg, content: '✅ **Course structure generated successfully!**' }
                        : msg
                )
            );

            // Reset streaming states
            setCurrentStreamingMessageId(null);
            setJsonBuffer('');
            jsonBufferRef.current = ''; // Reset ref too
            setIsAssemblingJson(false);
            setProcessingStatus('idle');

            setIsLoading(false);
        } catch (error) {
            console.error('❌ Streaming failed:', error);

            // Fallback error message
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: `⚠️ **Connection Error**\n\nSorry, I'm having trouble connecting to the AI service right now. This could be due to:\n\n- Network connectivity issues\n- Server maintenance\n- Authentication problems\n\nPlease try again in a moment, or check your connection settings.`,
                timestamp: new Date(),
                status: 'sent',
            };
            setMessages((prev) => [...prev, errorMessage]);
            setIsLoading(false);
        }
    };

    const startEditingMessage = (msg: Message) => {
        setEditingMessageId(msg.id);
        setEditingContent(msg.content);
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditingContent('');
    };

    const handleEditSend = () => {
        if (!editingMessageId) return;
        const originalMsgIndex = messages.findIndex((m) => m.id === editingMessageId);
        if (originalMsgIndex === -1) return;

        // update message content
        const updatedMessages = [...messages];
        const originalMsg = updatedMessages[originalMsgIndex]!; // non-null after bounds check
        updatedMessages[originalMsgIndex] = {
            ...originalMsg,
            content: editingContent,
        } as Message;

        // remove any AI responses after this message
        const msgsAfter = updatedMessages.slice(originalMsgIndex + 1);
        const firstAiIdx = msgsAfter.findIndex((m) => m.type === 'ai');
        if (firstAiIdx !== -1) {
            updatedMessages.splice(originalMsgIndex + 1);
        }

        setMessages(updatedMessages);
        setEditingMessageId(null);
        setEditingContent('');

        // trigger new AI response with streaming
        setIsLoading(true);

        (async () => {
            try {
                const aiMsg: Message = {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: '',
                    timestamp: new Date(),
                    status: 'sent',
                };
                setMessages((prev) => [...prev, aiMsg]);

                await sendStreamingMessage(editingContent, undefined, undefined, aiMsg.id);

                // Update message with streaming response
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMsg.id ? { ...msg, content: streamingResponse } : msg
                    )
                );

                setIsLoading(false);
            } catch (error) {
                console.error('❌ Edit streaming failed:', error);
                setIsLoading(false);
            }
        })();
    };

    // Real-time streaming response handler
    const sendStreamingMessage = async (
        userPrompt: string,
        attachments?: UploadedFile[],
        structuredPrompt?: StructuredPrompt,
        targetMessageId?: string
    ): Promise<void> => {
        // Reset streaming state
        setStreamingResponse('');
        setAllStreamChunks([]);

        const apiRequest: ChatApiRequest = {
            prompt: userPrompt,
            model: 'google/gemini-2.5-pro', // Default model
            attachments: attachments?.map((file) => ({
                id: file.id,
                name: file.name,
                type: file.type,
                url: file.url,
            })),
            codePrompt: structuredPrompt?.codePrompt,
            conversationHistory: messages.slice(-10).map((msg) => ({
                role: msg.type === 'user' ? 'user' : 'assistant',
                content: msg.content,
            })),
        };

        if (isDebugMode) {
            console.log('Starting streaming for request:', apiRequest);
        }

        return new Promise<void>((resolve, reject) => {
            const chunkIndex = 0;
            sendChatMessageStreaming(
                apiRequest,
                // onChunk callback - called for each streaming chunk
                (chunk: string) => {
                    if (isDebugMode) {
                        console.log('📡 AI Backend - Streaming chunk received:', chunk);
                    }

                    // Update debug state first (this should never fail)
                    try {
                        setAllStreamChunks((prev) => [...prev, chunk]);
                        setStreamingResponse((prev) => prev + chunk);
                    } catch (debugError) {
                        console.warn('⚠️ Debug state update failed:', debugError);
                    }

                    // Process chunk immediately - use targetMessageId directly if available
                    const messageIdToUse = targetMessageId || currentStreamingMessageId;

                    if (isDebugMode) {
                        console.log('🚀 Processing chunk immediately...');
                        console.log('🎯 Using message ID:', messageIdToUse);
                        console.log('📝 Chunk content preview:', chunk.substring(0, 100));
                    }

                    if (chunk && messageIdToUse) {
                        if (isDebugMode) {
                            console.log('✅ Both chunk and messageId available, processing...');
                        }
                        try {
                            processStreamingChunkDirect(chunk, messageIdToUse);
                        } catch (error) {
                            console.error('❌ Error in chunk processing:', error);
                        }
                    } else {
                        console.warn('⚠️ Missing chunk or messageId:', {
                            hasChunk: !!chunk,
                            chunkPreview: chunk?.substring(0, 50),
                            targetMessageId,
                            currentStreamingMessageId,
                            messageIdToUse,
                        });
                    }

                    // Send to debug if available (safely)
                    try {
                        if (onStreamingDebug) {
                            onStreamingDebug(chunk);
                        }
                    } catch (debugError) {
                        console.warn('⚠️ Debug callback failed:', debugError);
                    }
                },
                // onComplete callback - called when streaming is finished
                (finalResponse: ChatApiResponse) => {
                    if (isDebugMode) {
                        console.log('✅ AI Backend - Streaming complete:', finalResponse);
                    }
                    setStreamingResponse(finalResponse.content);

                    // Response capture removed

                    // Send final response to debug
                    if (onStreamingDebug) {
                        onStreamingDebug('', finalResponse.content);
                    }

                    // Try to process structured data from the response
                    tryProcessStructuredPayload(finalResponse.content);

                    resolve();
                },
                // onError callback - called if streaming fails
                (error: Error) => {
                    console.error('❌ Streaming error:', error);
                    reject(error);
                }
            );
        });
    };

    // UI Components for different section types
    const ThinkingSection: React.FC<{ section: ChatSection }> = ({ section }) => {
        return (
            <div className="mb-3 flex items-center gap-3 rounded-lg border-l-4 border-blue-400 bg-blue-50 p-4">
                <div className="text-lg text-blue-600">🧠</div>
                <div className="flex-1">
                    <div className="font-medium text-blue-800">AI is thinking...</div>
                    <div className="text-sm text-blue-600">{section.content}</div>
                </div>
            </div>
        );
    };

    const GeneratingSection: React.FC<{ section: ChatSection }> = ({ section }) => {
        return (
            <div className="mb-3 flex items-center gap-3 rounded-lg border-l-4 border-purple-400 bg-purple-50 p-4">
                <div className="animate-pulse text-lg text-purple-600">⚡</div>
                <div className="flex-1">
                    <div className="font-medium text-purple-800">Generating structure...</div>
                    <div className="text-sm text-purple-600">{section.content}</div>
                </div>
            </div>
        );
    };

    const ModificationSection: React.FC<{ section: ChatSection }> = ({ section }) => {
        const { targetType, name, modificationType } = section.metadata || {};

        const getIcon = (type: string) => {
            switch (type) {
                case 'COURSE':
                    return '📚';
                case 'MODULE':
                    return '📂';
                case 'CHAPTER':
                    return '📖';
                case 'SLIDE':
                    return '📄';
                default:
                    return '✨';
            }
        };

        const getStyles = (type: string) => {
            switch (type) {
                case 'COURSE':
                    return {
                        container: 'bg-emerald-50 border-emerald-400',
                        icon: 'text-emerald-600',
                        title: 'text-emerald-800',
                        name: 'text-emerald-700',
                        subtitle: 'text-emerald-600',
                        timestamp: 'text-emerald-500',
                    };
                case 'MODULE':
                    return {
                        container: 'bg-blue-50 border-blue-400',
                        icon: 'text-blue-600',
                        title: 'text-blue-800',
                        name: 'text-blue-700',
                        subtitle: 'text-blue-600',
                        timestamp: 'text-blue-500',
                    };
                case 'CHAPTER':
                    return {
                        container: 'bg-orange-50 border-orange-400',
                        icon: 'text-orange-600',
                        title: 'text-orange-800',
                        name: 'text-orange-700',
                        subtitle: 'text-orange-600',
                        timestamp: 'text-orange-500',
                    };
                case 'SLIDE':
                    return {
                        container: 'bg-purple-50 border-purple-400',
                        icon: 'text-purple-600',
                        title: 'text-purple-800',
                        name: 'text-purple-700',
                        subtitle: 'text-purple-600',
                        timestamp: 'text-purple-500',
                    };
                default:
                    return {
                        container: 'bg-gray-50 border-gray-400',
                        icon: 'text-gray-600',
                        title: 'text-gray-800',
                        name: 'text-gray-700',
                        subtitle: 'text-gray-600',
                        timestamp: 'text-gray-500',
                    };
            }
        };

        const styles = getStyles(targetType || '');

        return (
            <div
                className={`mb-3 flex items-center gap-3 rounded-lg border-l-4 p-4 ${styles.container}`}
            >
                <div className={`text-xl ${styles.icon}`}>{getIcon(targetType || '')}</div>
                <div className="flex-1">
                    <div className={`font-medium ${styles.title}`}>
                        {modificationType} {targetType}
                    </div>
                    <div className={`font-semibold ${styles.name}`}>{name}</div>
                    <div className={`text-sm ${styles.subtitle}`}>Added to course structure</div>
                </div>
                <div className={`text-xs ${styles.timestamp}`}>
                    {section.timestamp.toLocaleTimeString()}
                </div>
            </div>
        );
    };

    const TextSection: React.FC<{ section: ChatSection }> = ({ section }) => {
        return <div className="mb-2 leading-relaxed text-gray-800">{section.content}</div>;
    };

    const JsonSection: React.FC<{ section: ChatSection }> = ({ section }) => {
        const [isExpanded, setIsExpanded] = useState(false);

        // Try to parse the JSON content
        let parsedData;
        let isCourseStructureData = false;

        try {
            parsedData = JSON.parse(section.content);
            // Check if this looks like course structure data
            isCourseStructureData = !!(
                parsedData &&
                (parsedData.modifications || parsedData.todos || parsedData.explanation)
            );

            // Debug logging (disabled - UI working)
            // console.log('🔍 JsonSection Debug:', {
            //     hasModifications: !!parsedData?.modifications,
            //     hasTodos: !!parsedData?.todos,
            //     hasExplanation: !!parsedData?.explanation,
            //     isCourseStructureData,
            //     dataKeys: Object.keys(parsedData || {}),
            //     rawContent: section.content.substring(0, 200),
            // });
        } catch (error) {
            // If parsing fails, fall back to raw display
            parsedData = null;
            console.log('❌ JSON Parse Error:', error);
        }

        // If it's course structure data, use the specialized component
        if (isCourseStructureData && parsedData) {
            console.log('✅ Rendering CourseStructureDisplay with data:', {
                hasModifications: !!parsedData.modifications,
                modificationsCount: parsedData.modifications?.length || 0,
                hasTodos: !!parsedData.todos,
                todosCount: parsedData.todos?.length || 0,
                hasExplanation: !!parsedData.explanation,
            });
            return (
                <div className="mb-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                        📋 Course Structure Data Detected
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs">
                            {parsedData.modifications?.length || 0} modifications,{' '}
                            {parsedData.todos?.length || 0} todos
                        </span>
                    </div>
                    <CourseStructureDisplay data={parsedData} />
                </div>
            );
        }

        // Fall back to the original collapsible JSON display for other data
        console.log('📄 Rendering fallback JSON section:', {
            hasData: !!parsedData,
            contentLength: section.content.length,
            contentPreview: section.content.substring(0, 100),
        });

        return (
            <div className="mb-3 rounded-lg border-2 border-yellow-200 bg-yellow-50">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-yellow-100"
                >
                    <div className="flex items-center gap-2">
                        <Code className="size-4 text-yellow-600" />
                        <span className="font-medium text-yellow-800">
                            📄 JSON Data (Click to expand)
                        </span>
                        <span className="rounded bg-yellow-200 px-2 py-1 text-xs">
                            {Math.round((section.content.length / 1024) * 10) / 10}KB
                        </span>
                    </div>
                    <span
                        className={`text-yellow-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        ▼
                    </span>
                </button>
                {isExpanded && (
                    <div className="rounded-b-lg border-t bg-gray-900 p-3">
                        <pre className="overflow-x-auto text-xs text-green-400">
                            {parsedData ? JSON.stringify(parsedData, null, 2) : section.content}
                        </pre>
                    </div>
                )}
            </div>
        );
    };

    // Component to render structured message content
    const StructuredMessageContent: React.FC<{
        messageId: string;
        sections: ChatSection[];
    }> = ({ messageId, sections }) => {
        if (isDebugMode) {
            console.log(`🎨 RENDER: StructuredMessageContent for ${messageId}:`, {
                sectionsCount: sections.length,
                messageInSections: !!messageSections[messageId],
                allMessageIds: Object.keys(messageSections),
                sectionsInState: messageSections[messageId]?.length || 0,
                sectionsProp: sections.length,
            });
        }

        if (sections.length === 0) {
            if (isDebugMode) {
                console.log(
                    `❌ RENDER FALLBACK: No sections for ${messageId}, using fallback content`
                );
            }
            // Fallback to original message content if no sections
            const message = messages.find((m) => m.id === messageId);
            return message?.content ? (
                <div className="leading-relaxed text-gray-800">{message.content}</div>
            ) : (
                <div className="italic text-gray-400">No content available</div>
            );
        }

        return (
            <div className="space-y-2">
                {sections.map((section) => {
                    switch (section.type) {
                        case 'thinking':
                            return <ThinkingSection key={section.id} section={section} />;
                        case 'generating':
                            return <GeneratingSection key={section.id} section={section} />;
                        case 'modification':
                            return <ModificationSection key={section.id} section={section} />;
                        case 'text':
                            return <TextSection key={section.id} section={section} />;
                        case 'json':
                            console.log('🎨 Rendering JSON section in UI:', {
                                sectionId: section.id,
                                contentLength: section.content.length,
                                contentPreview: section.content.substring(0, 50),
                            });
                            console.log(
                                '%c🎨 JSON SECTION NOW VISIBLE IN UI',
                                'color: #3b82f6; font-weight: bold; font-size: 14px;'
                            );
                            return <JsonSection key={section.id} section={section} />;
                        default:
                            return <TextSection key={section.id} section={section} />;
                    }
                })}
            </div>
        );
    };

    // Helper function to add sections to messages with improved state management
    const addMessageSection = React.useCallback(
        (messageId: string, section: ChatSection) => {
            // Always log JSON sections for debugging UI issues
            if (section.type === 'json' || isDebugMode) {
                console.log(`➕ Adding ${section.type} section to message ${messageId}:`, {
                    type: section.type,
                    id: section.id,
                    contentPreview: section.content.substring(0, 100),
                });
            }

            try {
                setMessageSections((prev) => {
                    const currentSections = prev[messageId] || [];
                    const newSections = [...currentSections, section];

                    // Log section updates for JSON sections or when in debug mode
                    if (section.type === 'json' || isDebugMode) {
                        console.log(
                            `📝 Updated sections for ${messageId}: ${newSections.length} total sections`,
                            {
                                messageId,
                                sectionType: section.type,
                                totalSections: newSections.length,
                            }
                        );
                    }

                    const newState = {
                        ...prev,
                        [messageId]: newSections,
                    };

                    // Force immediate component re-render to ensure UI updates
                    setTimeout(() => {
                        setForceRenderCounter((c) => c + 1);
                        if (section.type === 'json' || isDebugMode) {
                            console.log(
                                `🔄 UI update triggered for ${messageId} (${section.type} section)`
                            );
                        }
                    }, 0);

                    return newState;
                });
            } catch (error) {
                console.error(`❌ CRITICAL ERROR adding section to message ${messageId}:`, error);
                console.error('❌ Stack trace:', (error as Error).stack);
                console.error('❌ Section data:', { messageId, section });
            }
        },
        [isDebugMode, setMessageSections, setForceRenderCounter]
    );

    // Update chat display with modification cards
    const updateChatWithModifications = React.useCallback(
        (modifications: Modification[]) => {
            if (isDebugMode) {
                console.log(
                    '💬 AI Backend - updateChatWithModifications called with',
                    modifications.length,
                    'modifications'
                );
            }

            if (currentStreamingMessageId && modifications.length > 0) {
                // Create a modification section for each modification
                modifications.forEach((mod) => {
                    addMessageSection(currentStreamingMessageId, {
                        id: `modification-${mod.node?.id || Date.now()}`,
                        type: 'modification',
                        content: `${mod.action} ${mod.targetType}`,
                        timestamp: new Date(),
                        metadata: {
                            modificationType: mod.action,
                            targetType: mod.targetType,
                            name: mod.node?.name || 'Unnamed',
                            modifications: [mod],
                        },
                    });
                });

                // Add JSON section with the modifications data
                addMessageSection(currentStreamingMessageId, {
                    id: `json-${Date.now()}`,
                    type: 'json',
                    content: JSON.stringify({ modifications }, null, 2),
                    timestamp: new Date(),
                    metadata: {
                        modifications,
                    },
                });
            }
        },
        [currentStreamingMessageId, addMessageSection, isDebugMode]
    );

    // Debounced modification application
    const debouncedApplyModifications = React.useMemo(() => {
        let timeoutId: NodeJS.Timeout;
        return (modifications: Modification[]) => {
            if (isDebugMode) {
                console.log(
                    '⏰ AI Backend - Debounced apply called with',
                    modifications.length,
                    'modifications'
                );
            }
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (isDebugMode) {
                    console.log('🎬 AI Backend - Executing debounced modifications after timeout');
                }

                // Filter out duplicates
                const uniqueModifications = modifications.filter(
                    (mod) =>
                        !processedModifications.some(
                            (existing) =>
                                existing.node?.id === mod.node?.id && existing.action === mod.action
                        )
                );

                if (isDebugMode) {
                    console.log(
                        '🔍 AI Backend - Filtered to',
                        uniqueModifications.length,
                        'unique modifications'
                    );
                }

                if (uniqueModifications.length > 0) {
                    setProcessedModifications((prev) => [...prev, ...uniqueModifications]);

                    // Apply to course structure with animation
                    if (onModifications) {
                        if (isDebugMode) {
                            console.log('🎯 AI Backend - Calling onModifications callback');
                        }
                        onModifications(uniqueModifications);
                    }

                    // Update chat display with visual modifications
                    updateChatWithModifications(uniqueModifications);
                }
            }, 100); // 100ms debounce
        };
    }, [processedModifications, onModifications, updateChatWithModifications, isDebugMode]);

    // Track processed JSON sections to avoid duplicates
    const [processedJsonSections, setProcessedJsonSections] = useState<Set<string>>(new Set());
    const processedJsonSectionsRef = useRef<Set<string>>(new Set());
    const lastJsonCreationTime = useRef<number>(0);

    // Try to create a complete JSON section for course structure data
    const tryCreateCompleteJsonSection = React.useCallback(
        (buffer: string, messageId: string) => {
            try {
                if (isDebugMode) {
                    console.log('🔍 tryCreateCompleteJsonSection called:', {
                        bufferLength: buffer.length,
                        hasSlideUpdate: buffer.includes('SLIDE_CONTENT_UPDATE'),
                        hasContentData: buffer.includes('contentData'),
                    });
                }

                // Clean the buffer - handle mixed data patterns better
                let cleanBuffer = buffer;

                // Remove data: prefixes and markdown markers more carefully
                // Use word boundaries to avoid corrupting JSON content
                cleanBuffer = cleanBuffer.replace(/\bdata:```json\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```data:/g, '');
                cleanBuffer = cleanBuffer.replace(/\bdata:\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```json\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```(?!\w)/g, ''); // Only remove ``` not followed by word chars

                // Fix double braces issue - but be more careful to avoid corrupting valid JSON
                // Only replace if it's clearly a mistake (not part of a string value)
                cleanBuffer = cleanBuffer.replace(/\{\{(?=\s*")/g, '{'); // {{ followed by quote
                cleanBuffer = cleanBuffer.replace(/\}\}(?=\s*[,}\]])/g, '}'); // }} followed by comma, brace, or bracket

                cleanBuffer = cleanBuffer.trim();

                // Look for complete JSON objects that contain course structure data
                // First, try to find complete JSON objects with better validation
                const matches = [];

                // Find all potential JSON start positions
                let startIndex = 0;
                while (startIndex < cleanBuffer.length) {
                    const openBraceIndex = cleanBuffer.indexOf('{', startIndex);
                    if (openBraceIndex === -1) break;

                    // Try to find the matching closing brace
                    let braceCount = 0;
                    let inString = false;
                    let escapeNext = false;
                    let endIndex = -1;

                    for (let i = openBraceIndex; i < cleanBuffer.length; i++) {
                        const char = cleanBuffer[i];

                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }

                        if (char === '\\') {
                            escapeNext = true;
                            continue;
                        }

                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }

                        if (!inString) {
                            if (char === '{') {
                                braceCount++;
                            } else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    endIndex = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (endIndex !== -1) {
                        const jsonStr = cleanBuffer.substring(openBraceIndex, endIndex + 1);
                        matches.push([jsonStr] as RegExpExecArray);
                        startIndex = endIndex + 1;
                    } else {
                        // No complete JSON found from this position
                        startIndex = openBraceIndex + 1;
                    }
                }

                if (isDebugMode) {
                    console.log('🔍 Found', matches.length, 'potential JSON matches');
                }

                // Special handling for SLIDE_CONTENT_UPDATE that might be in mixed data
                if (
                    matches.length === 0 &&
                    (cleanBuffer.includes('SLIDE_CONTENT_UPDATE') ||
                        cleanBuffer.includes('contentData'))
                ) {
                    if (isDebugMode) {
                        console.log('🔍 Attempting special SLIDE_CONTENT_UPDATE extraction');
                    }
                    // Try to extract JSON from patterns like: {"type":"SLIDE_CONTENT_UPDATE"...}
                    const slideUpdateMatch = cleanBuffer.match(
                        /\{"type":"SLIDE_CONTENT_UPDATE".*?\}/s
                    );
                    if (slideUpdateMatch) {
                        const fakeMatch = slideUpdateMatch as RegExpExecArray;
                        matches.push(fakeMatch);
                        if (isDebugMode) {
                            console.log('🔍 Found SLIDE_CONTENT_UPDATE via special extraction');
                        }
                    }
                }

                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    if (!match) continue;

                    const jsonStr = match[0];

                    // Basic validation before attempting to parse
                    if (!jsonStr || jsonStr.length < 10) {
                        if (isDebugMode) {
                            console.log(
                                `⚠️ Skipping too short JSON match ${i + 1}: ${jsonStr.length} chars`
                            );
                        }
                        continue;
                    }

                    // Check for obvious malformation
                    const openBraces = (jsonStr.match(/\{/g) || []).length;
                    const closeBraces = (jsonStr.match(/\}/g) || []).length;
                    if (openBraces !== closeBraces) {
                        if (isDebugMode) {
                            console.log(
                                `⚠️ Skipping unbalanced JSON match ${i + 1}: ${openBraces} open, ${closeBraces} close`
                            );
                        }
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (isDebugMode) {
                            console.log('✅ Successfully parsed JSON:', Object.keys(parsed || {}));
                        }

                        // Check if this looks like course structure data
                        const isCourseData = !!(
                            parsed &&
                            (parsed.modifications ||
                                parsed.todos ||
                                parsed.explanation ||
                                (parsed.type === 'SLIDE_CONTENT_UPDATE' &&
                                    parsed.path &&
                                    parsed.contentData))
                        );

                        if (isDebugMode) {
                            console.log('🔍 Is course data?', {
                                isCourseData,
                                hasModifications: !!parsed.modifications,
                                hasTodos: !!parsed.todos,
                                hasExplanation: !!parsed.explanation,
                                type: parsed.type,
                                hasPath: !!parsed.path,
                                hasContentData: !!parsed.contentData,
                                isSlideUpdate: parsed.type === 'SLIDE_CONTENT_UPDATE',
                            });
                        }

                        if (isCourseData) {
                            // Create a comprehensive identifier for this JSON content
                            const dataSignature = {
                                modifications: parsed.modifications?.length || 0,
                                todos: parsed.todos?.length || 0,
                                hasExplanation: !!parsed.explanation,
                                modificationNames:
                                    parsed.modifications
                                        ?.map((m: { name: string }) => m.name)
                                        .sort() || [],
                                todoNames:
                                    parsed.todos?.map((t: { name: string }) => t.name).sort() || [],
                                // Handle SLIDE_CONTENT_UPDATE
                                type: parsed.type || 'course_structure',
                                path: parsed.path || '',
                                hasContentData: !!parsed.contentData,
                            };
                            const normalizedJson = JSON.stringify(dataSignature);
                            const contentHash = btoa(normalizedJson).substring(0, 32);

                            // Check both ref and state to prevent duplicates + add debounce
                            const now = Date.now();
                            const timeSinceLastCreation = now - lastJsonCreationTime.current;

                            if (
                                !processedJsonSectionsRef.current.has(contentHash) &&
                                !processedJsonSections.has(contentHash) &&
                                timeSinceLastCreation > 200
                            ) {
                                // 200ms debounce

                                console.log('🎯 Creating JSON section for course data:', {
                                    hasModifications: !!parsed.modifications,
                                    hasTodos: !!parsed.todos,
                                    hasExplanation: !!parsed.explanation,
                                    contentHash,
                                });

                                // Also log to make it very obvious in console
                                console.log(
                                    '%c✅ JSON SECTION CREATED AND ADDED TO UI',
                                    'color: #10b981; font-weight: bold; font-size: 14px;'
                                );

                                // Mark as processed immediately in ref
                                processedJsonSectionsRef.current.add(contentHash);
                                lastJsonCreationTime.current = now;

                                // Add the JSON section
                                addMessageSection(messageId, {
                                    id: `json-course-${contentHash}`,
                                    type: 'json',
                                    content: JSON.stringify(parsed, null, 2),
                                    timestamp: new Date(),
                                });

                                // Mark this content as processed in state too
                                setProcessedJsonSections((prev) => new Set(prev).add(contentHash));
                            } else if (isDebugMode) {
                                console.log(
                                    '⚠️ Already processed this JSON content or too recent:',
                                    {
                                        contentHash,
                                        timeSinceLastCreation,
                                    }
                                );
                            }
                        }
                    } catch (parseError) {
                        const errorMsg =
                            parseError instanceof Error ? parseError.message : 'Unknown error';
                        if (isDebugMode) {
                            console.log(`❌ Failed to parse JSON match ${i + 1}:`, {
                                error: errorMsg,
                                jsonLength: jsonStr.length,
                                lastChar: jsonStr[jsonStr.length - 1],
                            });
                        }

                        // Try to fix common streaming JSON issues
                        if (errorMsg.includes('Expected') && jsonStr.endsWith(',')) {
                            if (isDebugMode) {
                                console.log('🔧 Attempting to fix trailing comma issue...');
                            }
                            try {
                                const fixedJson = jsonStr.replace(/,(\s*[}\]])/, '$1');
                                const parsed = JSON.parse(fixedJson);
                                if (isDebugMode) {
                                    console.log(
                                        '✅ Successfully parsed after fixing trailing comma'
                                    );
                                }

                                // Continue with the successfully parsed JSON
                                const isCourseData = !!(
                                    parsed &&
                                    (parsed.modifications ||
                                        parsed.todos ||
                                        parsed.explanation ||
                                        (parsed.type === 'SLIDE_CONTENT_UPDATE' &&
                                            parsed.path &&
                                            parsed.contentData))
                                );

                                if (isCourseData) {
                                    // Process the fixed JSON the same way as successful parses
                                    const dataSignature = {
                                        modifications: parsed.modifications?.length || 0,
                                        todos: parsed.todos?.length || 0,
                                        hasExplanation: !!parsed.explanation,
                                        modificationNames:
                                            parsed.modifications
                                                ?.map((m: { name: string }) => m.name)
                                                .sort() || [],
                                        todoNames:
                                            parsed.todos
                                                ?.map((t: { name: string }) => t.name)
                                                .sort() || [],
                                        type: parsed.type || 'course_structure',
                                        path: parsed.path || '',
                                        hasContentData: !!parsed.contentData,
                                    };
                                    const normalizedJson = JSON.stringify(dataSignature);
                                    const contentHash = btoa(normalizedJson).substring(0, 32);

                                    const now = Date.now();
                                    const timeSinceLastCreation =
                                        now - lastJsonCreationTime.current;

                                    if (
                                        !processedJsonSectionsRef.current.has(contentHash) &&
                                        !processedJsonSections.has(contentHash) &&
                                        timeSinceLastCreation > 200
                                    ) {
                                        processedJsonSectionsRef.current.add(contentHash);
                                        lastJsonCreationTime.current = now;

                                        addMessageSection(messageId, {
                                            id: `json-course-${contentHash}`,
                                            type: 'json',
                                            content: JSON.stringify(parsed, null, 2),
                                            timestamp: new Date(),
                                        });

                                        setProcessedJsonSections((prev) =>
                                            new Set(prev).add(contentHash)
                                        );
                                    }
                                }
                            } catch (fixError) {
                                if (isDebugMode) {
                                    console.log('❌ Failed to fix JSON:', fixError);
                                }
                            }
                        }
                        // Continue to next match
                    }
                }
            } catch (error) {
                console.log('❌ Error in tryCreateCompleteJsonSection:', error);
            }
        },
        [addMessageSection, processedJsonSections, isDebugMode]
    );

    // Try to reconstruct JSON from streaming line-by-line data
    const tryReconstructStreamingJson = React.useCallback(
        (buffer: string, messageId: string) => {
            try {
                if (isDebugMode) {
                    console.log('🔧 Trying to reconstruct streaming JSON from buffer:', {
                        bufferLength: buffer.length,
                        hasSlideUpdate: buffer.includes('SLIDE_CONTENT_UPDATE'),
                        hasContentData: buffer.includes('contentData'),
                    });
                }

                // Look for patterns that suggest we have streaming JSON data
                const hasJsonStructure =
                    buffer.includes('"modifications"') ||
                    buffer.includes('"todos"') ||
                    buffer.includes('"explanation"') ||
                    buffer.includes('"type":"SLIDE_CONTENT_UPDATE"') ||
                    buffer.includes('"contentData"') ||
                    buffer.includes('"slideType"');

                if (!hasJsonStructure) {
                    return;
                }

                // Try to reconstruct JSON by looking for common patterns
                const lines = buffer
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line);
                let jsonCandidate = '';
                let inJsonBlock = false;
                let braceCount = 0;

                for (const line of lines) {
                    if (line.includes('{')) {
                        inJsonBlock = true;
                        braceCount += (line.match(/\{/g) || []).length;
                    }

                    if (inJsonBlock) {
                        jsonCandidate += line + '\n';
                        braceCount -= (line.match(/\}/g) || []).length;

                        if (braceCount === 0 && jsonCandidate.trim().endsWith('}')) {
                            // We might have a complete JSON object
                            try {
                                let cleanJson = jsonCandidate.trim();

                                // Clean up mixed data - extract just the JSON part
                                // Remove data: prefixes and markdown markers
                                cleanJson = cleanJson.replace(/data:```json\s*/g, '');
                                cleanJson = cleanJson.replace(/```data:/g, '');
                                cleanJson = cleanJson.replace(/data:\s*/g, '');
                                cleanJson = cleanJson.replace(/```json\s*/g, '');
                                cleanJson = cleanJson.replace(/```[^{]*/g, ''); // Remove ``` followed by non-JSON content

                                // Extract just the JSON part if mixed with other content
                                const jsonStart = cleanJson.indexOf('{');
                                if (jsonStart !== -1) {
                                    // Find the end of the JSON by counting braces
                                    let braceCounter = 0;
                                    let jsonEnd = -1;
                                    let inString = false;
                                    let escapeNext = false;

                                    for (let i = jsonStart; i < cleanJson.length; i++) {
                                        const char = cleanJson[i];

                                        if (escapeNext) {
                                            escapeNext = false;
                                            continue;
                                        }

                                        if (char === '\\') {
                                            escapeNext = true;
                                            continue;
                                        }

                                        if (char === '"' && !escapeNext) {
                                            inString = !inString;
                                            continue;
                                        }

                                        if (!inString) {
                                            if (char === '{') {
                                                braceCounter++;
                                            } else if (char === '}') {
                                                braceCounter--;
                                                if (braceCounter === 0) {
                                                    jsonEnd = i;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    if (jsonEnd !== -1) {
                                        cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
                                    }
                                }

                                // Fix double braces issue
                                cleanJson = cleanJson.replace(/\{\{/g, '{');
                                cleanJson = cleanJson.replace(/\}\}/g, '}');

                                if (isDebugMode) {
                                    console.log(
                                        '🔧 Attempting to parse reconstructed JSON:',
                                        cleanJson.substring(0, 100)
                                    );
                                }

                                const parsed = JSON.parse(cleanJson);
                                const isCourseData = !!(
                                    parsed &&
                                    (parsed.modifications ||
                                        parsed.todos ||
                                        parsed.explanation ||
                                        (parsed.type === 'SLIDE_CONTENT_UPDATE' &&
                                            parsed.path &&
                                            parsed.contentData))
                                );

                                if (isCourseData) {
                                    // Create a comprehensive identifier for this JSON content
                                    const dataSignature = {
                                        modifications: parsed.modifications?.length || 0,
                                        todos: parsed.todos?.length || 0,
                                        hasExplanation: !!parsed.explanation,
                                        modificationNames:
                                            parsed.modifications
                                                ?.map((m: { name: string }) => m.name)
                                                .sort() || [],
                                        todoNames:
                                            parsed.todos
                                                ?.map((t: { name: string }) => t.name)
                                                .sort() || [],
                                        // Handle SLIDE_CONTENT_UPDATE
                                        type: parsed.type || 'course_structure',
                                        path: parsed.path || '',
                                        hasContentData: !!parsed.contentData,
                                    };
                                    const normalizedJson = JSON.stringify(dataSignature);
                                    const contentHash = btoa(normalizedJson).substring(0, 32);

                                    // Check both ref and state to prevent duplicates + add debounce
                                    const now = Date.now();
                                    const timeSinceLastCreation =
                                        now - lastJsonCreationTime.current;

                                    if (
                                        !processedJsonSectionsRef.current.has(contentHash) &&
                                        !processedJsonSections.has(contentHash) &&
                                        timeSinceLastCreation > 200
                                    ) {
                                        // 200ms debounce

                                        console.log(
                                            '🎯 Successfully reconstructed streaming JSON for course data!'
                                        );

                                        // Mark as processed immediately in ref
                                        processedJsonSectionsRef.current.add(contentHash);
                                        lastJsonCreationTime.current = now;

                                        addMessageSection(messageId, {
                                            id: `json-reconstructed-${contentHash}`,
                                            type: 'json',
                                            content: JSON.stringify(parsed, null, 2),
                                            timestamp: new Date(),
                                        });

                                        setProcessedJsonSections((prev) =>
                                            new Set(prev).add(contentHash)
                                        );
                                        return; // Success, stop trying
                                    }
                                }
                            } catch (parseError) {
                                if (isDebugMode) {
                                    console.log(
                                        '❌ Failed to parse reconstructed JSON:',
                                        parseError instanceof Error
                                            ? parseError.message
                                            : 'Unknown error'
                                    );
                                }
                            }

                            // Reset for next potential JSON block
                            jsonCandidate = '';
                            inJsonBlock = false;
                            braceCount = 0;
                        }
                    }
                }
            } catch (error) {
                console.log('❌ Error in tryReconstructStreamingJson:', error);
            }
        },
        [addMessageSection, processedJsonSections, isDebugMode]
    );

    // Extract complete modifications as soon as they're available
    const tryExtractCompleteModifications = React.useCallback(
        (buffer: string, messageId: string) => {
            try {
                // Clean the buffer - remove data: prefixes and extra whitespace
                // Clean the buffer more carefully
                let cleanBuffer = buffer;
                cleanBuffer = cleanBuffer.replace(/data:```json\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```data:/g, '');
                cleanBuffer = cleanBuffer.replace(/data:\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```json\s*/g, '');
                cleanBuffer = cleanBuffer.replace(/```/g, '');

                // Fix double braces issue
                cleanBuffer = cleanBuffer.replace(/\{\{/g, '{');
                cleanBuffer = cleanBuffer.replace(/\}\}/g, '}');

                cleanBuffer = cleanBuffer.trim();

                // Look for complete JSON blocks containing modifications OR SLIDE_CONTENT_UPDATE
                // First check for SLIDE_CONTENT_UPDATE
                // Use a more robust approach to extract the complete JSON
                let slideUpdateMatch = null;
                const typeIndex = cleanBuffer.indexOf('"type":"SLIDE_CONTENT_UPDATE"');
                if (typeIndex !== -1) {
                    // Find the opening brace before this
                    const openBraceIndex = cleanBuffer.lastIndexOf('{', typeIndex);
                    if (openBraceIndex !== -1) {
                        // Find the matching closing brace
                        let braceCount = 1;
                        let closeBraceIndex = openBraceIndex + 1;
                        while (closeBraceIndex < cleanBuffer.length && braceCount > 0) {
                            if (cleanBuffer[closeBraceIndex] === '{') braceCount++;
                            if (cleanBuffer[closeBraceIndex] === '}') braceCount--;
                            closeBraceIndex++;
                        }
                        if (braceCount === 0) {
                            const jsonStr = cleanBuffer.substring(openBraceIndex, closeBraceIndex);
                            slideUpdateMatch = [jsonStr];
                        }
                    }
                }

                if (slideUpdateMatch && slideUpdateMatch[0]) {
                    console.log('🔍 Found SLIDE_CONTENT_UPDATE in tryExtractCompleteModifications');
                    try {
                        const slideUpdateStr = slideUpdateMatch[0];
                        const slideUpdate = JSON.parse(slideUpdateStr);
                        console.log('🔍 Parsed SLIDE_CONTENT_UPDATE:', {
                            type: slideUpdate.type,
                            path: slideUpdate.path,
                            hasContentData: !!slideUpdate.contentData,
                        });

                        // Process this as course data
                        tryCreateCompleteJsonSection(slideUpdateStr, messageId);
                        return;
                    } catch (error) {
                        console.log('❌ Failed to parse SLIDE_CONTENT_UPDATE:', error);
                    }
                }

                // Then try to find complete modifications array
                const modificationsArrayMatch = cleanBuffer.match(
                    /\{\s*"modifications"\s*:\s*\[([\s\S]*?)\]\s*\}/
                );
                let matches: RegExpMatchArray[] = [];

                if (modificationsArrayMatch && modificationsArrayMatch[1]) {
                    // Extract individual modifications from the array
                    const modificationsContent = modificationsArrayMatch[1];
                    const modificationRegex = /\{\s*"action"[\s\S]*?\}/g;
                    matches = [...modificationsContent.matchAll(modificationRegex)];
                } else {
                    // Fallback: look for individual modification objects
                    const modificationRegex = /\{\s*"action"[\s\S]*?\}/g;
                    matches = [...cleanBuffer.matchAll(modificationRegex)];
                }

                const newModifications: Modification[] = [];

                for (const match of matches) {
                    try {
                        const modificationStr = match[0];

                        // Try to parse the modification object
                        const modification = JSON.parse(modificationStr);

                        if (isDebugMode) {
                            console.log('✅ AI Backend - Parsed modification:', modification);
                        }

                        // Validate required fields (be more lenient for streaming)
                        if (
                            modification.action &&
                            modification.targetType &&
                            (modification.node || modification.name)
                        ) {
                            newModifications.push(modification);
                            if (isDebugMode) {
                                console.log(
                                    '✅ AI Backend - Added valid modification:',
                                    modification.targetType,
                                    modification.node?.name || modification.name
                                );
                            }
                        }
                    } catch (parseError) {
                        // Ignore incomplete or malformed modifications - silent fail for streaming
                    }
                }

                // Apply new modifications immediately with debouncing
                if (newModifications.length > 0) {
                    if (isDebugMode) {
                        console.log(
                            '🚀 AI Backend - Applying',
                            newModifications.length,
                            'modifications'
                        );
                    }
                    debouncedApplyModifications(newModifications);
                }
            } catch (error) {
                // Ignore buffer parsing errors - probably incomplete JSON - silent fail for streaming
            }
        },
        [debouncedApplyModifications, isDebugMode, tryCreateCompleteJsonSection]
    );

    // Enhanced message structure for better UI - now imported from types

    // Refs to prevent stale closures in streaming functions
    const jsonBufferRef = useRef<string>('');

    // Enhanced processing function with structured content
    const processStreamingChunkDirect = (chunk: string, messageId: string) => {
        try {
            console.log(
                '🔧 PROCESSING CHUNK:',
                chunk.substring(0, 50),
                'processingStatus:',
                processingStatus
            );
            // Clean the chunk
            const cleanChunk = chunk.replace(/^data:/, '').trim();

            if (!cleanChunk) {
                return;
            }

            // Accumulate chunks for better pattern detection
            // (Removed duplicate setJsonBuffer call - using the one below for JSON processing)

            // Detect thinking sections (check both chunk and accumulated buffer)
            const fullContent = jsonBufferRef.current;
            const hasThinking =
                chunk.includes('[Thinking...]') ||
                cleanChunk.includes('[Thinking...]') ||
                fullContent.includes('[Thinking...]') ||
                cleanChunk.includes('🤔');

            if (hasThinking && processingStatus !== 'thinking') {
                console.log(
                    '🔧 EARLY RETURN: Thinking section detected, skipping JSON buffer logic'
                );
                setProcessingStatus('thinking');
                addMessageSection(messageId, {
                    id: `thinking-${Date.now()}`,
                    type: 'thinking',
                    content: 'AI is analyzing and planning the course structure...',
                    timestamp: new Date(),
                });
                return;
            }

            // Detect generating sections
            const hasGenerating =
                chunk.includes('[Generating...]') ||
                cleanChunk.includes('[Generating...]') ||
                fullContent.includes('[Generating...]') ||
                chunk.includes('[Generating') ||
                cleanChunk.includes('[Generating') ||
                cleanChunk.includes('⚡');

            if (hasGenerating && processingStatus !== 'generating') {
                console.log(
                    '🔧 EARLY RETURN: Generating section detected, skipping JSON buffer logic'
                );
                setProcessingStatus('generating');
                addMessageSection(messageId, {
                    id: `generating-${Date.now()}`,
                    type: 'generating',
                    content: 'Generating course structure components...',
                    timestamp: new Date(),
                });
                return;
            }

            // Handle JSON data chunks (safely)
            if (
                chunk.includes('```json') ||
                chunk.includes('{') ||
                chunk.includes('"modifications"') ||
                chunk.includes('"todos"') ||
                chunk.includes('"explanation"') ||
                chunk.includes('"type":"SLIDE_CONTENT_UPDATE"') ||
                chunk.includes('"contentData"') ||
                chunk.includes('"slideType"')
            ) {
                // console.log('🔧 JSON assembly triggered by chunk:', chunk.substring(0, 50));
                setIsAssemblingJson(true);
            }

            // console.log('🔧 REACHED JSON BUFFER LOGIC - about to call setJsonBuffer');

            // Update the buffer first
            const currentBuffer = jsonBufferRef.current;
            const newBuffer = currentBuffer + chunk;
            jsonBufferRef.current = newBuffer; // Update ref immediately

            if (isDebugMode) {
                console.log('🔧 Updated buffer directly:', {
                    chunkLength: chunk.length,
                    newBufferLength: newBuffer.length,
                });
            }

            // Also update the state (for React consistency)
            setJsonBuffer(newBuffer);

            // Try to extract and parse complete modification objects (safely)
            try {
                tryExtractCompleteModifications(newBuffer, messageId);
            } catch (extractError) {
                // Silent fail for streaming
            }

            // Try to detect complete JSON structure for course data
            try {
                if (isDebugMode) {
                    console.log('🔍 Checking JSON buffer for course data:', {
                        bufferLength: newBuffer.length,
                        hasModifications: newBuffer.includes('modifications'),
                        hasTodos: newBuffer.includes('todos'),
                        hasExplanation: newBuffer.includes('explanation'),
                    });
                }

                tryCreateCompleteJsonSection(newBuffer, messageId);
                tryReconstructStreamingJson(newBuffer, messageId);
            } catch (jsonError) {
                if (isDebugMode) {
                    console.log('❌ JSON detection error:', jsonError);
                }
            }

            // Add regular text content
            const shouldAddText =
                cleanChunk &&
                !chunk.includes('```') &&
                !cleanChunk.includes('[Thinking...]') &&
                !cleanChunk.includes('[Generating...]') &&
                !cleanChunk.includes('🤔') &&
                !cleanChunk.includes('⚡');

            if (isDebugMode) {
                console.log('🔍 Text content check:', {
                    cleanChunk: cleanChunk?.substring(0, 50),
                    hasCleanChunk: !!cleanChunk,
                    hasJson: chunk.includes('```'),
                    hasThinking: cleanChunk?.includes('[Thinking...]'),
                    hasGenerating: cleanChunk?.includes('[Generating...]'),
                    shouldAddText,
                });
            }

            if (shouldAddText) {
                if (isDebugMode) {
                    console.log('📝 Adding text section:', cleanChunk.substring(0, 50));
                }
                addMessageSection(messageId, {
                    id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'text',
                    content: cleanChunk,
                    timestamp: new Date(),
                });
            }
        } catch (error) {
            console.error('❌ Critical error in processStreamingChunkDirect (continuing):', error);
        }
    };

    // Auto-scroll when new sections are added
    useEffect(() => {
        if (Object.keys(messageSections).length > 0) {
            // Small delay to ensure DOM has updated
            setTimeout(() => {
                scrollToBottomIfAtBottom();
            }, 100);
        }
    }, [messageSections, scrollToBottomIfAtBottom]);

    // Legacy function for backward compatibility (now unused)
    const processStreamingChunk = React.useCallback((chunk: string) => {
        console.log('🔧 Legacy processStreamingChunk called (should not happen)');
    }, []);

    // Get appropriate icon for modification type
    const getModificationIcon = (targetType: string): string => {
        switch (targetType) {
            case 'COURSE':
                return '🎓';
            case 'MODULE':
                return '📚';
            case 'CHAPTER':
                return '📖';
            case 'SLIDE':
                return '📄';
            default:
                return '📌';
        }
    };

    // Process final response payload for any remaining structured data
    const tryProcessStructuredPayload = (payload: string) => {
        // Only process if we have a current streaming message ID
        if (currentStreamingMessageId) {
            try {
                // Extract any remaining modifications from the final payload
                tryExtractCompleteModifications(payload, currentStreamingMessageId);
            } catch (error) {
                if (isDebugMode) {
                    console.log('⚠️ AI Backend - Final payload processing failed:', error);
                }
            }
        }
    };

    const handleTemplateSelect = (template: PromptTemplate) => {
        setSelectedTemplate(template.id);
        setPrompt(template.prompt);
        textareaRef.current?.focus();
        // Resize textarea safely after value update
        setTimeout(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.setProperty('height', 'auto', 'important');
            const scrollHeight = el.scrollHeight;
            const style = window.getComputedStyle(el);
            const minH = parseInt(style.minHeight) || 60;
            const maxH = parseInt(style.maxHeight) || 300;
            const newH = Math.min(Math.max(scrollHeight, minH), maxH);
            el.style.setProperty('height', `${newH}px`, 'important');
            el.style.setProperty('overflow-y', newH >= maxH ? 'auto' : 'hidden', 'important');
        }, 0);
    };

    const handleExampleSelect = (example: string) => {
        console.log('🎯 EXAMPLE CLICKED:', example);
        console.log('🔍 Current message count before:', messages.length);
        console.log('🔍 Using setMessages:', setMessages === setLocalMessages ? 'LOCAL' : 'PROPS');

        setPrompt(example);
        textareaRef.current?.focus();

        // Auto-send the example prompt after setting it
        setTimeout(() => {
            // Create a temporary prompt state for sending
            const tempPrompt = example;

            // Directly create and send the message without waiting for state update
            if (!tempPrompt.trim() || isLoading) {
                console.log('❌ Cannot send: empty prompt or loading', {
                    hasPrompt: !!tempPrompt.trim(),
                    isLoading,
                });
                return;
            }

            const userMessage = {
                id: Date.now().toString(),
                type: 'user' as const,
                content: tempPrompt,
                timestamp: new Date(),
                status: 'sent' as const,
            };

            console.log('👤 Creating user message:', userMessage);

            setMessages((prev) => {
                console.log('👤 setMessages callback - prev.length:', prev.length);
                const newMessages = [...prev, userMessage];
                console.log('👤 setMessages callback - new.length:', newMessages.length);

                // Trigger chat start callback if this is the first message
                if (newMessages.length === 1 && onChatStart) {
                    console.log('🚀 Triggering onChatStart');
                    setTimeout(onChatStart, 100);
                }
                return newMessages;
            });

            // Clear the prompt and hide welcome
            setPrompt('');

            // Hide cinematic intro when first message is sent
            if (showCinematicIntro) {
                setShowCinematicIntro(false);
            }

            // Set loading state
            console.log('⚡ Setting loading to true');
            setIsLoading(true);

            // Create AI placeholder message
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                type: 'ai' as const,
                content: '🔄 **Connecting to AI...**',
                timestamp: new Date(),
                status: 'sent' as const,
            };

            console.log('🤖 Creating AI placeholder message:', aiMessage);

            setMessages((prev) => {
                console.log('🤖 setMessages callback - prev.length:', prev.length);
                const newMessages = [...prev, aiMessage];
                console.log('🤖 setMessages callback - new.length:', newMessages.length);
                return newMessages;
            });

            // Now trigger the actual AI streaming (using same logic as handleSendMessage)
            const messageId = aiMessage.id;
            console.log('🎯 Setting currentStreamingMessageId:', messageId);
            setCurrentStreamingMessageId(messageId);
            setJsonBuffer('');
            setIsAssemblingJson(false);
            setProcessingStatus('idle');

            // API request structure (copied from handleSendMessage)
            const apiRequest = {
                prompt: tempPrompt,
                model: selectedModel,
                attachments: [], // No attachments for example prompts
                context: selectedContextOptions,
            };

            sendChatMessageStreaming(
                apiRequest,
                // onChunk callback
                (chunk: string) => {
                    if (isDebugMode) {
                        console.log(
                            '📡 AI Backend - Streaming chunk received from example:',
                            chunk
                        );
                    }
                    setAllStreamChunks((prev) => [...prev, chunk]);
                    setStreamingResponse((prev) => prev + chunk);

                    const messageIdToUse = messageId;
                    try {
                        if (chunk && messageIdToUse) {
                            processStreamingChunkDirect(chunk, messageIdToUse);
                        }
                    } catch (error) {
                        console.error('❌ Error processing chunk:', error);
                    }
                },
                // onComplete callback
                (finalResponse) => {
                    if (isDebugMode) {
                        console.log('✅ AI Backend - Example streaming complete:', finalResponse);
                    }
                    setStreamingResponse(finalResponse.content);
                    setIsLoading(false);

                    if (onStreamingDebug) {
                        onStreamingDebug('', finalResponse.content);
                    }
                },
                // onError callback
                (error) => {
                    console.error('❌ Example streaming error:', error);
                    setIsLoading(false);
                }
            ).catch((error) => {
                console.error('❌ Example API request failed:', error);
                setIsLoading(false);
            });
        }, 100); // Small delay to ensure textarea is ready
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const copyToClipboard = (msgId: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageId(msgId);
        setTimeout(() => setCopiedMessageId(null), 1000);
    };

    const regenerateResponse = async (aiMessageId: string) => {
        if (isLoading) return;
        const aiIndex = messages.findIndex((m) => m.id === aiMessageId);
        if (aiIndex === -1) return;

        // Find the last user message before this AI message
        let userMsg: Message | null = null;
        for (let i = aiIndex - 1; i >= 0; i--) {
            const potential = messages[i];
            if (potential && potential.type === 'user') {
                userMsg = potential;
                break;
            }
        }

        if (!userMsg) return;

        // Remove the AI message and generate a new one
        const newMessages = messages.slice(0, aiIndex);
        setMessages(newMessages);
        setIsLoading(true);

        // Regenerate using streaming API
        (async () => {
            try {
                const newAiMsg: Message = {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: '',
                    timestamp: new Date(),
                    status: 'sent',
                };
                setMessages((prev) => [...prev, newAiMsg]);

                await sendStreamingMessage(
                    userMsg!.content,
                    userMsg!.attachments,
                    userMsg!.structuredPrompt,
                    newAiMsg.id
                );

                // Update message with streaming response
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === newAiMsg.id ? { ...msg, content: streamingResponse } : msg
                    )
                );

                setIsLoading(false);
            } catch (error) {
                console.error('❌ Regenerate streaming failed:', error);
                setIsLoading(false);
            }
        })();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach((file) => {
            const fileType = file.type.startsWith('image/')
                ? 'image'
                : file.type === 'application/pdf'
                  ? 'pdf'
                  : file.type.startsWith('video/')
                    ? 'video'
                    : null;

            if (fileType) {
                const newFile: UploadedFile = {
                    id: Date.now().toString() + Math.random(),
                    name: file.name,
                    type: fileType,
                    size: file.size,
                    url: URL.createObjectURL(file),
                    file,
                };
                setUploadedFiles((prev) => [...prev, newFile]);
            }
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeFile = (fileId: string) => {
        setUploadedFiles((prev) => {
            const file = prev.find((f) => f.id === fileId);
            if (file) {
                URL.revokeObjectURL(file.url);
            }
            return prev.filter((f) => f.id !== fileId);
        });
    };

    const handleCodeSubmit = () => {
        setInputMode('code');
        setShowCodeDialog(false);
        if (codePrompt.code || codePrompt.description) {
            setPrompt(codePrompt.description || 'Code snippet included');
        }
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'pdf':
                return <FileText className="size-4" />;
            case 'video':
                return <Video className="size-4" />;
            case 'image':
                return <ImageIcon className="size-4" />;
            default:
                return <FileUp className="size-4" />;
        }
    };

    const handleContextOptionSelect = (optionId: string) => {
        setSelectedContextOptions((prev) =>
            prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
        );
    };

    const handleContextSubmit = () => {
        // For now, just close the dialog - functionality can be added later
        setShowContextDialog(false);
        setContextSearchQuery('');
        setSelectedContextOptions([]);
    };

    const handleContextDialogOpen = (open: boolean) => {
        setShowContextDialog(open);
        if (open) {
            // Reset dialog state when opening
            setContextSearchQuery('');
            setSelectedContextOptions([]);
        }
    };

    const filteredContextOptions = CONTEXT_OPTIONS.filter(
        (option) =>
            option.title.toLowerCase().includes(contextSearchQuery.toLowerCase()) ||
            option.description.toLowerCase().includes(contextSearchQuery.toLowerCase())
    );

    const userMessagesCount = useMemo(
        () => messages.filter((m) => m.type === 'user').length,
        [messages]
    );
    const showWelcome = userMessagesCount === 0;

    return (
        <div
            className={`ai-chat-container compact-mode ${isFullScreen ? 'fullscreen-chat' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
            {/* Cinematic Intro */}
            {showCinematicIntro && (
                <div className="cinematic-intro">
                    <div className="intro-overlay"></div>
                    <div className="intro-content">
                        {/* Phase 1: Logo Animation */}
                        <div className={`intro-logo ${introPhase >= 1 ? 'visible' : ''}`}>
                            <div className="logo-container">
                                <Brain className="logo-icon" />
                                <Sparkles className="sparkle-1" />
                                <Sparkles className="sparkle-2" />
                                <Sparkles className="sparkle-3" />
                            </div>
                        </div>

                        {/* Phase 2: Text Animation */}
                        <div className={`intro-text ${introPhase >= 2 ? 'visible' : ''}`}>
                            <h1 className="intro-title">
                                <span className="text-gradient">AI Course Creator</span>
                            </h1>
                            <p className="intro-subtitle">
                                Transforming ideas into interactive learning experiences
                            </p>
                        </div>

                        {/* Phase 3: Loading bar */}
                        <div className={`intro-loader ${introPhase >= 3 ? 'complete' : ''}`}>
                            <div className="loader-bar"></div>
                            <p className="loader-text">Initializing AI Assistant...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Start templates removed for full-width chat area */}

            {/* Todo Progress List */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 5,
                    background: 'hsl(var(--background))',
                    borderBottom: '1px solid hsl(var(--border))',
                }}
            >
                <TodoProgress
                    onTaskClick={onTaskClick}
                    onStartAutomation={onCourseGeneration}
                    isAutomationRunning={isLoading}
                />
            </div>

            {/* Chat Messages */}
            <div className="chat-messages" ref={chatMessagesRef}>
                {/* Welcome Overlay - Only render when showing welcome */}
                {showWelcome && (
                    <div className="welcome-overlay">
                        <h2 className="welcome-title">
                            Welcome to{' '}
                            <span style={{ color: 'hsl(var(--primary-500))' }}>
                                AI-Course Creation
                            </span>
                        </h2>
                        <p className="welcome-text">
                            Try one of the prompts below, or start typing your own.
                        </p>

                        <div className="welcome-prompts">
                            {EXAMPLE_PROMPTS.slice(0, 6).map((example, idx) => (
                                <button
                                    type="button"
                                    key={idx}
                                    className="welcome-prompt"
                                    onClick={() => handleExampleSelect(example)}
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((message, index) => (
                    <div key={message.id} className={`message ${message.type}`}>
                        <div className="message-avatar">
                            {message.type === 'ai' ? (
                                <Bot className="size-5" />
                            ) : (
                                <>
                                    {currentUser?.avatarUrl && (
                                        <img
                                            src={currentUser.avatarUrl}
                                            alt={currentUser.name || 'User'}
                                            onError={(e) => {
                                                // Hide image and show fallback icon
                                                const img = e.currentTarget;
                                                const fallbackIcon =
                                                    img.parentElement?.querySelector(
                                                        '.fallback-icon'
                                                    );
                                                img.style.display = 'none';
                                                if (fallbackIcon) {
                                                    (fallbackIcon as HTMLElement).style.display =
                                                        'block';
                                                }
                                            }}
                                        />
                                    )}
                                    <UserIcon
                                        className={`fallback-icon size-5 ${currentUser?.avatarUrl ? 'hidden' : ''}`}
                                    />
                                </>
                            )}
                        </div>
                        <div className="message-content">
                            {editingMessageId === message.id ? (
                                <div className="space-y-1">
                                    <Textarea
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        rows={1}
                                        className="edit-textarea"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={
                                                editingContent.trim() === message.content.trim()
                                            }
                                            onClick={handleEditSend}
                                        >
                                            Send
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="message-header">
                                        <span className="message-sender">
                                            {message.type === 'ai' ? 'AI Assistant' : 'You'}
                                        </span>
                                        <span className="message-time">
                                            {message.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                    <div className="message-text">
                                        {message.showTodoList ? (
                                            <TodoList />
                                        ) : message.type === 'ai' ? (
                                            (() => {
                                                const sectionsForMessage =
                                                    messageSections[message.id] || [];
                                                if (isDebugMode) {
                                                    console.log(
                                                        `🎨 PASSING SECTIONS to render for ${message.id}:`,
                                                        {
                                                            sectionsFound:
                                                                sectionsForMessage.length,
                                                            allSectionKeys:
                                                                Object.keys(messageSections),
                                                            messageId: message.id,
                                                            timestamp: message.timestamp,
                                                        }
                                                    );
                                                }
                                                return (
                                                    <StructuredMessageContent
                                                        messageId={message.id}
                                                        sections={sectionsForMessage}
                                                    />
                                                );
                                            })()
                                        ) : (
                                            <pre className="message-pre">{message.content}</pre>
                                        )}

                                        {/* File Attachments */}
                                        {message.attachments && message.attachments.length > 0 && (
                                            <div className="message-attachments">
                                                {message.attachments.map((file) => (
                                                    <div key={file.id} className="attachment-item">
                                                        {getFileIcon(file.type)}
                                                        <span className="attachment-name">
                                                            {file.name}
                                                        </span>
                                                        <span className="attachment-size">
                                                            ({Math.round(file.size / 1024)}
                                                            KB)
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Structured Code Prompt */}
                                        {message.structuredPrompt?.codePrompt && (
                                            <div className="code-prompt-display">
                                                <div className="code-prompt-header">
                                                    <Code className="size-4" />
                                                    <span>
                                                        Code Snippet -{' '}
                                                        {
                                                            message.structuredPrompt.codePrompt
                                                                .language
                                                        }
                                                    </span>
                                                    <div className="code-settings">
                                                        {message.structuredPrompt.codePrompt
                                                            .canEdit && (
                                                            <Edit3 className="size-3" />
                                                        )}
                                                        {message.structuredPrompt.codePrompt
                                                            .canRun && <Play className="size-3" />}
                                                    </div>
                                                </div>
                                                {message.structuredPrompt.codePrompt
                                                    .description && (
                                                    <div className="code-description">
                                                        {
                                                            message.structuredPrompt.codePrompt
                                                                .description
                                                        }
                                                    </div>
                                                )}
                                                <pre className="code-content">
                                                    {message.structuredPrompt.codePrompt.code}
                                                </pre>
                                            </div>
                                        )}

                                        {/* Streaming indicator for AI messages */}
                                        {message.type === 'ai' &&
                                            message.status === 'streaming' && (
                                                <div className="streaming-indicator">
                                                    <div className="streaming-cursor">|</div>
                                                    <span className="streaming-text">
                                                        AI is generating...
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                    {/* AI actions handled below to avoid duplication */}
                                    {message.type === 'user' && editingMessageId !== message.id && (
                                        <div className="message-actions">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => startEditingMessage(message)}
                                            >
                                                <Edit3 className="size-3" />
                                            </Button>
                                            <div className="tooltip">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        copyToClipboard(message.id, message.content)
                                                    }
                                                >
                                                    {copiedMessageId === message.id ? (
                                                        <Check className="size-3" />
                                                    ) : (
                                                        <Copy className="size-3" />
                                                    )}
                                                </Button>
                                                <span className="tooltip-text">Copy message</span>
                                            </div>
                                        </div>
                                    )}

                                    {message.type === 'ai' && (
                                        <div className="message-actions">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => regenerateResponse(message.id)}
                                            >
                                                <RefreshCw className="size-3" />
                                            </Button>
                                            <div className="tooltip">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        copyToClipboard(message.id, message.content)
                                                    }
                                                >
                                                    {copiedMessageId === message.id ? (
                                                        <Check className="size-3" />
                                                    ) : (
                                                        <Copy className="size-3" />
                                                    )}
                                                </Button>
                                                <span className="tooltip-text">Copy message</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="message ai">
                        <div className="message-avatar">
                            <Bot className="size-5" />
                        </div>
                        <div className="message-content">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />

                {/* Removed scroll indicator */}
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
                {/* Upload Files Display */}
                {uploadedFiles.length > 0 && (
                    <div className="uploaded-files-preview">
                        <h4>Uploaded Files:</h4>
                        <div className="files-list">
                            {uploadedFiles.map((file) => (
                                <div key={file.id} className="file-preview">
                                    {getFileIcon(file.type)}
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">
                                        ({Math.round(file.size / 1024)}KB)
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeFile(file.id)}
                                        className="remove-file"
                                    >
                                        <X className="size-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Code Mode Display */}
                {inputMode === 'code' && (codePrompt.code || codePrompt.description) && (
                    <div className="code-preview">
                        <div className="code-preview-header">
                            <Code className="size-4" />
                            <span>Code Snippet Ready</span>
                            <Button size="sm" variant="ghost" onClick={() => setInputMode('text')}>
                                <X className="size-3" />
                            </Button>
                        </div>
                        <div className="code-preview-settings">Language: {codePrompt.language}</div>
                    </div>
                )}

                {/* Input Mode Selector */}
                <div className="input-mode-selector">
                    <Button
                        size="sm"
                        variant={inputMode === 'text' ? 'default' : 'ghost'}
                        onClick={() => setInputMode('text')}
                    >
                        <FileText className="size-4" />
                        Text
                    </Button>

                    <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" />
                        Upload
                    </Button>

                    <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant={inputMode === 'code' ? 'default' : 'ghost'}>
                                <Code className="size-4" />
                                Code
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Add Code Snippet</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="language">Programming Language</Label>
                                    <Select
                                        value={codePrompt.language}
                                        onValueChange={(value) =>
                                            setCodePrompt((prev) => ({ ...prev, language: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="javascript">JavaScript</SelectItem>
                                            <SelectItem value="python">Python</SelectItem>
                                            <SelectItem value="java">Java</SelectItem>
                                            <SelectItem value="cpp">C++</SelectItem>
                                            <SelectItem value="html">HTML</SelectItem>
                                            <SelectItem value="css">CSS</SelectItem>
                                            <SelectItem value="sql">SQL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="code">Code</Label>
                                    <Textarea
                                        id="code"
                                        placeholder="Enter your code here..."
                                        value={codePrompt.code}
                                        onChange={(e) =>
                                            setCodePrompt((prev) => ({
                                                ...prev,
                                                code: e.target.value,
                                            }))
                                        }
                                        rows={10}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCodeDialog(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCodeSubmit}>Add Code</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showContextDialog} onOpenChange={handleContextDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                                <Plus className="size-4" />
                                Add Context
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add Context</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Search Input */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        placeholder="Add files, folders, docs..."
                                        value={contextSearchQuery}
                                        onChange={(e) => setContextSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Context Options */}
                                <div className="max-h-96 overflow-y-auto">
                                    {filteredContextOptions.map((option) => (
                                        <div
                                            key={option.id}
                                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50 ${
                                                selectedContextOptions.includes(option.id)
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200'
                                            }`}
                                            onClick={() => handleContextOptionSelect(option.id)}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="rounded-md bg-gray-100 p-2">
                                                    {option.icon}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium">
                                                        {option.title}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {option.description}
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="size-4 text-gray-400" />
                                        </div>
                                    ))}
                                </div>

                                {/* Selected Context Display */}
                                {selectedContextOptions.length > 0 && (
                                    <div className="border-t pt-4">
                                        <div className="mb-2 text-sm font-medium">
                                            Selected Context:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedContextOptions.map((optionId) => {
                                                const option = CONTEXT_OPTIONS.find(
                                                    (opt) => opt.id === optionId
                                                );
                                                return option ? (
                                                    <div
                                                        key={optionId}
                                                        className="flex items-center space-x-1 rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-800"
                                                    >
                                                        {option.icon}
                                                        <span>{option.title}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleContextOptionSelect(optionId);
                                                            }}
                                                            className="ml-1 hover:text-blue-600"
                                                        >
                                                            <X className="size-3" />
                                                        </button>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowContextDialog(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleContextSubmit}>Add Context</Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="input-container">
                    <div className="textarea-container">
                        <Textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKeyPress}
                            placeholder={
                                inputMode === 'code'
                                    ? 'How should this code be used in your course?'
                                    : uploadedFiles.length > 0
                                      ? 'How should these files be used?'
                                      : 'What course would you like to create?'
                            }
                            className="chat-textarea"
                        />
                        {/* Model Selector */}
                        <div className="model-selector-container" ref={modelDropdownRef}>
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="model-selector-button"
                                type="button"
                            >
                                <Bot className="size-3" />
                                <span>Models</span>
                            </button>

                            {showModelDropdown && (
                                <div className="model-dropdown">
                                    {MODEL_OPTIONS.map((model) => (
                                        <button
                                            key={model}
                                            onClick={() => {
                                                setSelectedModel(model);
                                                setShowModelDropdown(false);
                                            }}
                                            className={`model-option ${selectedModel === model ? 'selected' : ''}`}
                                        >
                                            {model}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handleSendMessage}
                            disabled={
                                (!prompt.trim() &&
                                    uploadedFiles.length === 0 &&
                                    inputMode === 'text') ||
                                isLoading
                            }
                            className="send-button-inside"
                            size="sm"
                        >
                            <Send className="size-4" />
                        </Button>
                    </div>
                </div>

                <div className="input-footer">
                    <div className="input-tips">
                        <Target className="size-4" />
                        <span>
                            {inputMode === 'code'
                                ? 'Code snippets help create interactive programming lessons'
                                : uploadedFiles.length > 0
                                  ? 'Files will be analyzed and integrated into your course'
                                  : 'Be specific about your target audience, topic, and desired learning outcomes'}
                        </span>
                    </div>
                    <div className="character-count">{prompt.length}/2000</div>
                </div>

                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.mp4,.mov,.avi,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
            </div>
        </div>
    );
};

export default ChatView;
