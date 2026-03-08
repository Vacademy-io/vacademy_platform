/* eslint-disable */
// @ts-nocheck
'use client';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import React, { useEffect, useState, FormEvent, useRef } from 'react';
import { Button as ShadButton } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Edit,
    FileText as FilePresentation,
    Loader2,
    Plus,
    Search,
    Trash2,
    Share2,
    Tv2,
    UploadCloud,
    HelpCircle,
    Clock,
    Trophy,
    Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useGetPresntation } from './hooks/useGetPresntation';
import { getInstituteId } from '@/constants/helper';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { toast } from 'sonner';
import { EDIT_PRESENTATION } from '@/constants/urls';
import { useQueryClient } from '@tanstack/react-query';
import { MyButton } from '@/components/design-system/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useSlideStore } from '@/stores/Slides/useSlideStore';
import { createNewSlide } from './utils/util';
import { SlideTypeEnum } from './utils/types';
import { AiGeneratingLoader, aiSteps, pptSteps } from './AiGeneratingLoader';
import { PRODUCT_NAME } from '@/config/branding';
import { VoltFeaturesGrid } from '@/components/landing/VoltFeaturesGrid';
import { useFileUpload } from "@/hooks/use-file-upload";

import type { PresentationData } from './types';
import { SessionLeaderboardModal } from './components/SessionLeaderboardModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';
const IMPORT_PPT_API_URL = `${BACKEND_URL}/media-service/convert-presentations/import-ppt`;
const VOLT_FIRST_VISIT_KEY = 'volt-has-visited';

export default function ManageVolt() {
    const router = useRouter();
    const { setNavHeading } = useNavHeadingStore();
    const queryClient = useQueryClient();

    const { data: fetchedPresentations, isLoading, refetch } = useGetPresntation();
    const [presentations, setPresentations] = useState<PresentationData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const { uploadFile, getPublicUrl, isUploading: isUploadingFile } = useFileUpload();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiLanguage, setAiLanguage] = useState('English');
    const [isGenerating, setIsGenerating] = useState(false);

    const [isPptModalOpen, setIsPptModalOpen] = useState(false);
    const [pptFile, setPptFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPresentation, setEditingPresentation] = useState<PresentationData | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [presentationToDelete, setPresentationToDelete] = useState<PresentationData | null>(null);
    const [isProcessingDelete, setIsProcessingDelete] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    // Session history
    const [isSessionHistoryOpen, setIsSessionHistoryOpen] = useState(false);
    const [sessionHistorySessions, setSessionHistorySessions] = useState<any[]>([]);
    const [isLoadingSessionHistory, setIsLoadingSessionHistory] = useState(false);
    const [historyPresentationTitle, setHistoryPresentationTitle] = useState('');
    const [leaderboardSessionId, setLeaderboardSessionId] = useState<string | null>(null);

    useEffect(() => {
        const hasVisited = localStorage.getItem(VOLT_FIRST_VISIT_KEY);
        if (!hasVisited) {
            setIsHelpModalOpen(true);
        }
    }, []);

    const handleHelpModalClose = () => {
        localStorage.setItem(VOLT_FIRST_VISIT_KEY, 'true');
        setIsHelpModalOpen(false);
    };

    useEffect(() => {
        setNavHeading(`Manage ${PRODUCT_NAME}s`);
    }, [setNavHeading]);

    useEffect(() => {
        if (fetchedPresentations) {
            // Filter out deleted presentations
            const activePresentations = (fetchedPresentations as PresentationData[]).filter(
                (presentation) => presentation.status !== 'DELETED'
            );
            console.log('[ManageVolt] Filtered presentations:', {
                total: fetchedPresentations.length,
                active: activePresentations.length,
                deleted: fetchedPresentations.length - activePresentations.length,
                deletedIds: (fetchedPresentations as PresentationData[])
                    .filter(p => p.status === 'DELETED')
                    .map(p => ({ id: p.id, title: p.title, status: p.status }))
            });
            setPresentations(activePresentations);
        }
    }, [fetchedPresentations]);

    const handlePptImport = async (e: FormEvent) => {
        e.preventDefault();
        if (!pptFile) {
            toast.error('Please select a PPT/PPTX file to import.');
            return;
        }
        setIsImporting(true);
        console.log(`[PPT Import] Starting import for file: "${pptFile.name}"`);

        try {
            const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
            const userId = tokenData?.sub;
            if (!userId) {
                throw new Error("User not authenticated. Please log in.");
            }

            const fileId = await uploadFile({
                file: pptFile,
                setIsUploading,
                userId,
                source: "PPT",
                sourceId: pptFile.name,
            });

            if (!fileId) {
                throw new Error("File upload failed and did not return a file ID.");
            }

            const response = await authenticatedAxiosInstance.post(
                IMPORT_PPT_API_URL,
                { fileId: fileId },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const importedSlides = response.data;
            console.log('[PPT Import] Received slides:', importedSlides);

            if (!Array.isArray(importedSlides) || importedSlides.length === 0) {
                throw new Error('No slides were generated from the PPT file.');
            }

            const { setSlides, setCurrentSlideId, initializeNewPresentationState } =
                useSlideStore.getState();

            initializeNewPresentationState();

            const finalSlides = importedSlides.map((slide, index) => ({
                ...slide,
                slide_order: index,
            }));

            console.log('[PPT Import] Processed slides for store:', finalSlides);
            setSlides(finalSlides);
            setCurrentSlideId(finalSlides.length > 0 ? finalSlides[0].id : undefined);

            toast.success('PPT imported successfully! Opening editor...');
            setIsPptModalOpen(false);

            const fileNameWithoutExt =
                pptFile.name.split('.').slice(0, -1).join('.') || `Imported ${PRODUCT_NAME}s`;

            router.navigate({
                to: '/study-library/volt/add',
                search: {
                    title: fileNameWithoutExt,
                    description: `Imported from ${pptFile.name}`,
                    id: '',
                    isEdit: false,
                    source: 'ppt',
                },
            });
        } catch (error: any) {
            console.error('[PPT Import] Error:', error);
            toast.error(
                error.response?.data?.message || `Failed to import ${PRODUCT_NAME.toLowerCase()} from PPT.`
            );
        } finally {
            setIsImporting(false);
            setPptFile(null);
        }
    };

    const handleAiGenerate = async (e: FormEvent) => {
        e.preventDefault();
        if (!aiTopic.trim()) {
            toast.error('Topic is required for AI generation.');
            return;
        }
        setIsGenerating(true);
        console.log(`[AI Gen] Starting generation for topic: "${aiTopic}"`);

        try {
            const response = await authenticatedAxiosInstance.post(
                `${BACKEND_URL}/media-service/ai/presentation/generateFromData`,
                {
                    language: aiLanguage,
                    text: aiTopic,
                    institute_id: getInstituteId(),
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const data = response.data;
            console.log('[AI Gen] Received data:', data);

            if (!data.slides || !data.assessment) {
                throw new Error('Invalid response structure from AI service.');
            }

            const { setSlides, setCurrentSlideId, initializeNewPresentationState } =
                useSlideStore.getState();

            initializeNewPresentationState(); // Clear out any old state

            const allNewSlides = [];

            // Process Excalidraw slides
            data.slides.forEach((slideData) => {
                const newSlide = createNewSlide(SlideTypeEnum.Excalidraw);
                const excalidrawSlide = {
                    ...newSlide,
                    elements: slideData.elements,
                    appState: {
                        ...newSlide.appState,
                        ...slideData.appState,
                    },
                };
                allNewSlides.push(excalidrawSlide);
            });

            // Process Questions
            data.assessment.questions.forEach((questionData) => {
                const isMcq = questionData.question_type === 'MCQS';
                const type = isMcq ? SlideTypeEnum.Quiz : SlideTypeEnum.Feedback;
                const newSlide = createNewSlide(type);

                const questionElements: any = {
                    questionName: questionData.question.content,
                };

                if (isMcq) {
                    questionElements.singleChoiceOptions = questionData.options.map((opt) => ({
                        id: `option_${Math.random()}`, // temp id
                        name: opt.content,
                        isSelected: (questionData.correct_options || []).includes(opt.preview_id),
                    }));
                } else {
                    questionElements.feedbackAnswer = '';
                }

                const questionSlide = {
                    ...newSlide,
                    elements: questionElements,
                };
                allNewSlides.push(questionSlide);
            });

            const finalSlides = allNewSlides.map((slide, index) => ({
                ...slide,
                slide_order: index,
            }));

            console.log('[AI Gen] Processed slides for store:', finalSlides);
            setSlides(finalSlides);
            setCurrentSlideId(finalSlides.length > 0 ? finalSlides[0].id : undefined);

            toast.success('AI Presentation generated successfully! Opening editor...');
            setIsAiModalOpen(false);

            router.navigate({
                to: '/study-library/volt/add',
                search: {
                    title: data.title || `AI Generated ${PRODUCT_NAME}`,
                    description: `Generated from topic: ${aiTopic}`,
                    id: '',
                    isEdit: false,
                    source: 'ai',
                },
            });
        } catch (error: any) {
            console.error('[AI Gen] Error:', error);
            toast.error(
                error.response?.data?.message || `Failed to generate ${PRODUCT_NAME.toLowerCase()} from topic.`
            );
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreatePresentation = (e: FormEvent) => {
        e.preventDefault();
        const title = newTitle.trim();
        if (!title) {
            toast.error(`Title is required to create a ${PRODUCT_NAME.toLowerCase()}.`);
            return;
        }

        const { setSlides, setCurrentSlideId, initializeNewPresentationState } =
            useSlideStore.getState();

        initializeNewPresentationState(); // Clear out any old state
        setSlides([]);

        router.navigate({
            to: '/study-library/volt/add',
            search: { isEdit: 'false', title: title, description: newDescription },
        });

        // Reset and close modal
        setNewTitle('');
        setNewDescription('');
        setIsCreateModalOpen(false);
    };

    const handleEditPresentationDetails = (presentation: PresentationData) => {
        router.navigate({
            to: '/study-library/volt/add',
            search: {
                id: presentation.id,
                title: presentation.title,
                description: presentation.description,
            },
        });
    };

    const confirmDeletePresentation = (presentation: PresentationData) => {
        setPresentationToDelete(presentation);
        setIsDeleteDialogOpen(true);
    };

    const executeDeletePresentation = async () => {
        if (!presentationToDelete) return;
        setIsProcessingDelete(true);
        try {
            console.log('[Delete] Starting deletion for presentation:', presentationToDelete.id);

            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            if (!accessToken) {
                toast.error('Authentication required. Please log in.');
                setIsProcessingDelete(false);
                return;
            }
            const tokenData = getTokenDecodedData(accessToken);
            const INSTITUTE_ID = tokenData?.authorities && Object.keys(tokenData.authorities)[0];
            if (!INSTITUTE_ID) {
                toast.error('Institute ID not found. Cannot delete volt.');
                setIsProcessingDelete(false);
                return;
            }

            console.log('[Delete] Making API call to delete presentation');
            const response = await authenticatedAxiosInstance.post(
                EDIT_PRESENTATION,
                {
                    ...presentationToDelete,
                    status: 'DELETED',
                    added_slides: [],
                    updated_slides: [],
                    deleted_slides: [],
                },
                {
                    params: { instituteId: INSTITUTE_ID },
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            console.log('[Delete] API call successful:', response.data);
            console.log('[Delete] Response status:', response.status);
            console.log('[Delete] Response headers:', response.headers);

            // Immediately remove from local state to provide instant feedback
            setPresentations(prev => prev.filter(p => p.id !== presentationToDelete.id));

            // Clear cache completely and force fresh fetch
            await queryClient.removeQueries({ queryKey: ['GET_PRESENTATIONS'] });
            await queryClient.invalidateQueries({ queryKey: ['GET_PRESENTATIONS'] });
            await queryClient.refetchQueries({ queryKey: ['GET_PRESENTATIONS'] });

            // Also manually refetch as a fallback
            await refetch();

            console.log('[Delete] Query invalidated and refetched');

            toast.success(`Volt "${presentationToDelete.title}" deleted successfully.`);
        } catch (error: any) {
            console.error('[Delete] Error details:', error);
            console.error('[Delete] Response data:', error.response?.data);
            console.error('[Delete] Status:', error.response?.status);

            // If the API call failed, revert the local state change
            if (presentationToDelete) {
                setPresentations(prev => {
                    const exists = prev.find(p => p.id === presentationToDelete.id);
                    if (!exists) {
                        return [...prev, presentationToDelete];
                    }
                    return prev;
                });
            }

            toast.error(
                error.response?.data?.message || error.message || 'Failed to delete volt.'
            );
        } finally {
            setIsProcessingDelete(false);
            setIsDeleteDialogOpen(false);
            setPresentationToDelete(null);
        }
    };

    const handleDirectStartLive = (presentation: PresentationData) => {
        if (presentation.added_slides_count === 0 && (!presentation.added_slides || presentation.added_slides.length === 0)) {
            toast.error(`This ${PRODUCT_NAME.toLowerCase()} has no slides. Add slides before starting a live session.`);
            return;
        }
        // Navigate to the editor component with a query param to auto-start the session
        router.navigate({
            to: '/study-library/volt/add',
            search: {
                id: presentation.id,
                title: presentation.title,
                description: presentation.description,
                autoStartLive: 'true',
            },
        });
    };

    const BACKEND_URL_HIST = import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io';

    const openSessionHistory = async (presentation: PresentationData) => {
        setHistoryPresentationTitle(presentation.title || 'Untitled');
        setSessionHistorySessions([]);
        setIsSessionHistoryOpen(true);
        setIsLoadingSessionHistory(true);
        try {
            const res = await authenticatedAxiosInstance.get(
                `${BACKEND_URL_HIST}/community-service/engage/admin/presentation/${presentation.id}/sessions`
            );
            setSessionHistorySessions(res.data || []);
        } catch {
            toast.error('Failed to load session history');
        } finally {
            setIsLoadingSessionHistory(false);
        }
    };

    const filteredPresentations = presentations.filter((p) => {
        const query = searchQuery.toLowerCase();
        return (
            p.title?.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
        );
    });

    const getStatusBadgeClass = (status: string = 'draft') => {
        switch (status.toLowerCase()) {
            case 'published':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'draft':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'archived':
                return 'bg-gray-100 text-gray-700 border-gray-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 text-neutral-800 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My {PRODUCT_NAME}s</h1>
                    <p className="text-md mt-1.5 text-neutral-500">
                        Manage, create, and organize your {PRODUCT_NAME.toLowerCase()}s.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ShadButton
                        variant="outline"
                        className="text-slate-600"
                        onClick={() => setIsHelpModalOpen(true)}
                    >
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Help
                    </ShadButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <MyButton size="lg" className="gap-2 px-5 py-2.5">
                                <Plus className="h-5 w-5" /> New {PRODUCT_NAME}
                                <ChevronDown className="h-4 w-4" />
                            </MyButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => setIsCreateModalOpen(true)}>
                                From Scratch
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsAiModalOpen(true)}>
                                Generate with AI
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsPptModalOpen(true)}>
                                Import PPT/PPTX
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="mb-6">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <Input
                        placeholder={`Search ${PRODUCT_NAME.toLowerCase()}s by title or description...`}
                        className="w-full rounded-lg bg-white py-2.5 pl-10 pr-4 text-base shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {filteredPresentations.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredPresentations.map((p) => (
                        <Card
                            key={p.id}
                            className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-300 hover:border-orange-300 hover:shadow-lg cursor-pointer"
                            onClick={() => handleEditPresentationDetails(p)}
                        >
                            <CardHeader className="px-4 pb-3 pt-4">
                                <CardTitle className="line-clamp-2 text-lg font-semibold leading-tight text-neutral-800 transition-colors hover:text-orange-600">
                                    {p.title || 'Untitled Volt'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow px-4 pb-3">
                                <p className="mb-3 line-clamp-3 min-h-[60px] text-sm text-neutral-600">
                                    {p.description || 'No description available.'}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'border px-2 py-0.5 font-normal',
                                            getStatusBadgeClass(p.status || 'draft')
                                        )}
                                    >
                                        {p.status
                                            ? p.status.charAt(0).toUpperCase() + p.status.slice(1)
                                            : 'Draft'}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="border-neutral-200 bg-neutral-50 px-2 py-0.5 font-normal"
                                    >
                                        {p.added_slides_count || p.added_slides?.length || 0} slides
                                    </Badge>
                                </div>
                            </CardContent>
                            <CardFooter className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/50 px-4 py-2.5">
                                <span className="text-xs text-neutral-500">
                                    Updated: {' '}
                                    {p.updated_at
                                        ? new Date(p.updated_at).toLocaleDateString()
                                        : 'N/A'}
                                </span>
                                <div className="flex gap-0.5">
                                    <ShadButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-neutral-500 hover:bg-blue-100 hover:text-blue-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const shareUrl = `https://${import.meta.env.VITE_ENGAGE_DOMAIN || 'engage.vacademy.io'}/volt/public/${p.id}`;
                                            window.open(shareUrl, '_blank');
                                            toast.info(`Public ${PRODUCT_NAME.toLowerCase()} link opened!`);
                                        }}
                                        title={`Share ${PRODUCT_NAME}`}
                                    >
                                        <Share2 className="h-4 w-4" />
                                    </ShadButton>
                                    <ShadButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-neutral-500 hover:bg-green-100 hover:text-green-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDirectStartLive(p)
                                        }}
                                        title="Start Live Session"
                                    >
                                        <Tv2 className="h-4 w-4" />
                                    </ShadButton>
                                    <ShadButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-neutral-500 hover:bg-purple-100 hover:text-purple-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openSessionHistory(p);
                                        }}
                                        title="Session History"
                                    >
                                        <Clock className="h-4 w-4" />
                                    </ShadButton>
                                    <ShadButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-neutral-500 hover:bg-orange-100 hover:text-orange-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditPresentationDetails(p)
                                        }}
                                        title="Edit Volt"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </ShadButton>
                                    <ShadButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-md text-neutral-500 hover:bg-red-100 hover:text-red-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            confirmDeletePresentation(p)
                                        }}
                                        title="Delete Volt"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </ShadButton>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/70 px-6 py-20 text-center">
                    <FilePresentation className="mb-5 h-16 w-16 text-neutral-300" />
                    <h3 className="text-xl font-semibold text-neutral-700">
                        {searchQuery ? 'No Matching Volts' : 'No Volts Yet'}
                    </h3>
                    <p className="mt-2 max-w-sm text-neutral-500">
                        {searchQuery
                            ? `Your search for "${searchQuery}" did not return any results. Try a different term or clear the search.`
                            : "It looks like you haven't created any volts. Get started by clicking the 'New Volts' button."}
                    </p>
                    {searchQuery && (
                        <MyButton
                            variant="outline"
                            className="mt-6"
                            onClick={() => setSearchQuery('')}
                        >
                            Clear Search
                        </MyButton>
                    )}
                </div>
            )}

            {/* Session History Modal */}
            <Dialog open={isSessionHistoryOpen} onOpenChange={setIsSessionHistoryOpen}>
                <DialogContent className="p-0 sm:max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader className="px-6 pt-6 pb-4 border-b">
                        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Clock className="size-5 text-purple-500" />
                            Session History — {historyPresentationTitle}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Past live sessions for this presentation, stored in DB.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {isLoadingSessionHistory ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="size-8 animate-spin text-purple-500" />
                            </div>
                        ) : sessionHistorySessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Clock className="mb-3 size-12 text-slate-200" />
                                <p className="text-sm text-slate-500">No sessions found for this presentation.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sessionHistorySessions.map((s: any) => (
                                    <div
                                        key={s.session_id}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-block h-2 w-2 rounded-full ${
                                                    s.status === 'FINISHED' ? 'bg-green-500' :
                                                    s.status === 'LIVE' ? 'bg-blue-500 animate-pulse' :
                                                    'bg-slate-300'
                                                }`} />
                                                <span className="text-sm font-medium text-slate-700">
                                                    {s.started_at
                                                        ? new Date(s.started_at).toLocaleString()
                                                        : new Date(s.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Users className="size-3" />
                                                    {s.participant_count} participants
                                                </span>
                                                {s.ended_at && s.started_at && (
                                                    <span>
                                                        {Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min
                                                    </span>
                                                )}
                                                <span className="font-mono text-slate-300">#{s.invite_code}</span>
                                            </div>
                                        </div>
                                        <ShadButton
                                            size="sm"
                                            variant="outline"
                                            className="ml-4 shrink-0 gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
                                            onClick={() => setLeaderboardSessionId(s.session_id)}
                                        >
                                            <Trophy className="size-3.5" />
                                            Results
                                        </ShadButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="border-t px-6 py-3 flex justify-end">
                        <ShadButton variant="outline" size="sm" onClick={() => setIsSessionHistoryOpen(false)}>
                            Close
                        </ShadButton>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Leaderboard from history */}
            {leaderboardSessionId && (
                <SessionLeaderboardModal
                    isOpen={!!leaderboardSessionId}
                    onClose={() => setLeaderboardSessionId(null)}
                    sessionId={leaderboardSessionId}
                />
            )}

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="p-6 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold text-red-600">
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription className="mt-2 text-neutral-600">
                            Are you sure you want to delete the presentation titled "
                            <strong>{presentationToDelete?.title || ''}</strong>"? This action
                            cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6 !justify-stretch space-y-2 sm:flex sm:flex-row sm:space-x-3 sm:space-y-0">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            onClick={() => setIsDeleteDialogOpen(false)}
                            disabled={isProcessingDelete}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </MyButton>
                        <MyButton
                            type="button"
                            variant="destructive"
                            onClick={executeDeletePresentation}
                            disabled={isProcessingDelete}
                            className="w-full sm:w-auto"
                        >
                            {isProcessingDelete ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                                </>
                            ) : (
                                'Yes, Delete Volt'
                            )}
                        </MyButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="p-6 sm:max-w-lg">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-xl font-semibold">
                            Create New {PRODUCT_NAME}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-neutral-500">
                            Provide a title and description. You'll add slides in the next step.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreatePresentation} className="space-y-5">
                        <div>
                            <Label htmlFor="new-title" className="text-sm font-medium">
                                Title
                            </Label>
                            <Input
                                id="new-title"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="mt-1.5 w-full"
                                placeholder="e.g., Quarterly Business Review"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="new-description" className="text-sm font-medium">
                                Description (Optional)
                            </Label>
                            <Textarea
                                id="new-description"
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="mt-1.5 min-h-[80px] w-full"
                                placeholder="A brief summary of your Volt"
                                rows={3}
                            />
                        </div>
                        <DialogFooter className="mt-6 !justify-stretch space-y-2 sm:flex sm:flex-row sm:space-x-3 sm:space-y-0">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-full sm:w-auto"
                            >
                                Cancel
                            </MyButton>
                            <MyButton type="submit" className="w-full sm:w-auto">
                                Create & Add Slides
                            </MyButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
                <DialogContent className="p-6 sm:max-w-lg">
                    {isGenerating ? (
                        <AiGeneratingLoader
                            title="Generating your Volt"
                            description="Our AI is crafting your content. This may take a moment."
                            steps={aiSteps}
                        />
                    ) : (
                        <>
                            <DialogHeader className="mb-4">
                                <DialogTitle className="text-xl font-semibold">
                                    Generate Volt with AI
                                </DialogTitle>
                                <DialogDescription className="text-sm text-neutral-500">
                                    Provide a topic and language to generate slides and questions.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAiGenerate} className="space-y-5">
                                <div>
                                    <Label htmlFor="ai-topic" className="text-sm font-medium">
                                        Topic
                                    </Label>
                                    <Textarea
                                        id="ai-topic"
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        className="mt-1.5 min-h-[100px] w-full"
                                        placeholder="e.g., An overview of the thermite reaction, its chemical properties, applications, and safety precautions."
                                        required
                                        rows={4}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="ai-language" className="text-sm font-medium">
                                        Language
                                    </Label>
                                    <Input
                                        id="ai-language"
                                        value={aiLanguage}
                                        onChange={(e) => setAiLanguage(e.target.value)}
                                        className="mt-1.5 w-full"
                                        placeholder="e.g., English"
                                        required
                                    />
                                </div>
                                <DialogFooter className="mt-6 !justify-stretch space-y-2 sm:flex sm:flex-row sm:space-x-3 sm:space-y-0">
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        onClick={() => setIsAiModalOpen(false)}
                                        className="w-full sm:w-auto"
                                    >
                                        Cancel
                                    </MyButton>
                                    <MyButton type="submit" className="w-full sm:w-auto">
                                        Generate & Create
                                    </MyButton>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isPptModalOpen} onOpenChange={setIsPptModalOpen}>
                <DialogContent className="p-6 sm:max-w-lg">
                    {isImporting ? (
                        <AiGeneratingLoader
                            title="Importing your Volt"
                            description="We're converting your file into editable slides. Please wait."
                            steps={pptSteps}
                        />
                    ) : (
                        <>
                            <DialogHeader className="mb-4">
                                <DialogTitle className="text-xl font-semibold">
                                    Import from PPT/PPTX
                                </DialogTitle>
                                <DialogDescription className="text-sm text-neutral-500">
                                    Select a .ppt or .pptx file to convert into slides.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handlePptImport} className="space-y-5">
                                <div>
                                    <Label htmlFor="ppt-file" className="text-sm font-medium">
                                        Volt File
                                    </Label>
                                    <div
                                        className="mt-1.5 flex justify-center w-full px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-md cursor-pointer hover:border-orange-400"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="space-y-1 text-center">
                                            <UploadCloud className="mx-auto h-12 w-12 text-neutral-400" />
                                            <div className="flex text-sm text-neutral-600">
                                                <span className="relative font-medium text-orange-600 hover:text-orange-500">
                                                    {pptFile ? 'Replace file' : 'Upload a file'}
                                                </span>
                                                <input
                                                    ref={fileInputRef}
                                                    id="ppt-file-input"
                                                    name="ppt-file"
                                                    type="file"
                                                    className="sr-only"
                                                    accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                                    onChange={(e) => setPptFile(e.target.files?.[0] || null)}
                                                />
                                                {!pptFile && <p className="pl-1">or drag and drop</p>}
                                            </div>
                                            <p className="text-xs text-neutral-500">
                                                {pptFile ? pptFile.name : 'PPT, PPTX up to 50MB'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="mt-6 !justify-stretch space-y-2 sm:flex sm:flex-row sm:space-x-3 sm:space-y-0">
                                    <MyButton
                                        type="button"
                                        buttonType="secondary"
                                        onClick={() => {
                                            setIsPptModalOpen(false);
                                            setPptFile(null);
                                        }}
                                        className="w-full sm:w-auto"
                                    >
                                        Cancel
                                    </MyButton>
                                    <MyButton
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={!pptFile}
                                    >
                                        Import & Create
                                    </MyButton>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
                <DialogContent
                    className="w-[75vw] max-w-7xl h-[90vh] overflow-y-auto"
                    onCloseAutoFocus={handleHelpModalClose}
                >
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-center">
                            Welcome to {PRODUCT_NAME}! Here's what you can do.
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Explore the powerful features that make {PRODUCT_NAME} the best way to create and deliver
                            interactive presentations.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <VoltFeaturesGrid />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
