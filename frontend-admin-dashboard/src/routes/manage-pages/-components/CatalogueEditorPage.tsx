import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    getCatalogueMeta,
    getDraftRevision,
    saveDraftRevision,
    publishDraftRevision,
} from '../-services/catalogue-service';
import { useEditorStore } from '../-stores/editor-store';
import React, { useEffect, useRef, useState } from 'react';
import { ComponentLibrary } from './ComponentLibrary';
import { TemplateLibrary } from './TemplateLibrary';
import { LayersPanel } from './LayersPanel';
import { PropertyPanel } from './PropertyPanel';
import { PageTabs } from './PageTabs';
import { CanvasRenderer } from './CanvasRenderer';
import { AiCopilotPanel } from './AiCopilotPanel';
import { RevisionHistoryDialog } from './RevisionHistoryDialog';
import { Button } from '@/components/ui/button';
import {
    CircleNotch as Loader2, FloppyDisk as Save, Code, Layout as LayoutTemplate,
    ArrowUUpLeft as Undo2, ArrowUUpRight as Redo2, Stack as Layers,
    PuzzlePiece as PuzzleIcon, List, RocketLaunch, ClockCounterClockwise, Sparkle,
} from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { Route } from '../editor/$tagName';
import { CatalogueConfig } from '../-types/editor-types';
import { useCataloguePermissions } from '../-hooks/use-catalogue-permissions';
import { useCallback } from 'react';
import {
    DndContext, DragEndEvent, DragStartEvent, DragOverlay,
    useSensor, useSensors, PointerSensor,
} from '@dnd-kit/core';
import { getComponentTemplate } from '../-utils/component-templates';
import { Textarea } from '@/components/ui/textarea';

export const CatalogueEditorPage = () => {
    const { tagName } = Route.useParams();
    const instituteId = getCurrentInstituteId();
    const {
        setConfig,
        config,
        activeTab,
        setActiveTab,
        updateConfig,
        undo,
        redo,
        canUndo,
        canRedo,
        selectedPageId,
        selectPage,
        addComponent,
        addToSlot,
    } = useEditorStore();
    const { toast } = useToast();
    const { canWrite } = useCataloguePermissions();

    // Drag-from-library: pointer sensor with a small activation distance to allow clicks
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const type = event.active.data.current?.type as string | undefined;
        setActiveDragLabel(type ? type.replace(/([A-Z])/g, ' $1').trim() : 'Component');
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!active.data.current?.type || !selectedPageId || !over) return;

            const templateKey = active.data.current.type as string;
            const component = getComponentTemplate(templateKey);
            const overId = over.id.toString();

            if (overId.startsWith('slot::')) {
                const parts = overId.split('::');
                const layoutId = parts[1];
                const slotIndex = parseInt(parts[2] ?? '', 10);
                if (layoutId && !isNaN(slotIndex)) {
                    addToSlot(selectedPageId, layoutId, slotIndex, component);
                }
            } else if (overId === 'canvas-drop-zone') {
                addComponent(selectedPageId, component);
            }

            setActiveDragLabel(null);
        },
        [selectedPageId, addComponent, addToSlot]
    );

    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'components' | 'layers' | 'templates'>('components');
    const [rightTab, setRightTab] = useState<'properties' | 'ai'>('properties');
    const [savedConfigJSON, setSavedConfigJSON] = useState('');
    const isDirty = config ? JSON.stringify(config) !== savedConfigJSON : false;

    const queryClient = useQueryClient();
    const [hasDraft, setHasDraft] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Draft/publish model: the editor works on a DRAFT revision; learners keep
    // seeing the last PUBLISHED config until the admin hits Publish.
    const { data: meta, isLoading: metaLoading } = useQuery({
        queryKey: ['catalogueMeta', instituteId, tagName],
        queryFn: () => getCatalogueMeta(instituteId!, tagName),
        enabled: !!instituteId && !!tagName,
    });
    const catalogueId = meta?.id;

    const draftQuery = useQuery({
        queryKey: ['catalogueDraft', catalogueId],
        queryFn: () => getDraftRevision(catalogueId!),
        enabled: !!catalogueId,
    });

    const isLoading = metaLoading || (!!catalogueId && !draftQuery.isFetched);

    const saveMutation = useMutation({
        mutationFn: (newConfig: CatalogueConfig) => saveDraftRevision(catalogueId!, newConfig),
        onSuccess: (savedRevision, savedConfig) => {
            setSavedConfigJSON(JSON.stringify(savedConfig));
            setHasDraft(true);
            // Keep the draft cache honest (the save response omits the JSON) so
            // a later focus refetch doesn't look like fresh server state.
            queryClient.setQueryData(['catalogueDraft', catalogueId], {
                ...savedRevision,
                catalogue_json: JSON.stringify(savedConfig),
            });
            toast({ title: 'Draft saved', description: 'Publish when you want learners to see it' });
        },
        onError: (err) => {
            toast({
                title: 'Error',
                description: 'Failed to save changes',
                variant: 'destructive',
            });
            console.error(err);
        },
    });

    const publishMutation = useMutation({
        mutationFn: async () => {
            // Publish always ships what's on screen: persist the draft first
            if (config) await saveDraftRevision(catalogueId!, config);
            return publishDraftRevision(catalogueId!);
        },
        onSuccess: () => {
            if (config) setSavedConfigJSON(JSON.stringify(config));
            setHasDraft(false);
            // The draft was promoted — clear its cache or the stale entry flips
            // the badge back to "Draft" on the next refetch.
            queryClient.setQueryData(['catalogueDraft', catalogueId], null);
            queryClient.invalidateQueries({ queryKey: ['catalogueMeta', instituteId, tagName] });
            queryClient.invalidateQueries({ queryKey: ['catalogueRevisions', catalogueId] });
            toast({ title: 'Published', description: 'The site is now live with this version' });
        },
        onError: (err) => {
            toast({ title: 'Publish failed', description: 'Please try again', variant: 'destructive' });
            console.error(err);
        },
    });

    // Hydrate ONCE per catalogue. Background refetches (window focus,
    // post-publish invalidation) must never re-run setConfig — it resets undo
    // history/selection and would clobber unsaved edits.
    const loadedForRef = useRef<string | null>(null);
    useEffect(() => {
        if (!meta || !draftQuery.isFetched) return;
        if (loadedForRef.current === meta.id) return;
        const json = draftQuery.data?.catalogue_json || meta.catalogue_json;
        if (!json) return;
        try {
            const parsed = JSON.parse(json);
            setConfig(parsed);
            setSavedConfigJSON(json);
            setHasDraft(!!draftQuery.data);
            loadedForRef.current = meta.id;
        } catch (e) {
            console.error('Failed to parse catalogue JSON', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meta, draftQuery.isFetched, draftQuery.data, setConfig]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    // Sync JSON text when switching to JSON mode
    useEffect(() => {
        if (activeTab === 'json' && config) {
            setJsonText(JSON.stringify(config, null, 2));
            setJsonError(null);
        }
    }, [activeTab, config]);

    const handleJsonChange = (value: string) => {
        setJsonText(value);
        try {
            const parsed = JSON.parse(value);
            // Validate required top-level structure
            if (!parsed.globalSettings || !Array.isArray(parsed.pages)) {
                setJsonError('JSON must have "globalSettings" and "pages" array');
                return;
            }
            setJsonError(null);
            updateConfig(parsed);
        } catch {
            setJsonError('Invalid JSON');
        }
    };

    // Keyboard shortcuts: Undo/Redo + Ctrl+S to save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo()) undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                if (canRedo()) redo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (config && canWrite && !saveMutation.isPending && !publishMutation.isPending && !jsonError && catalogueId) {
                    saveMutation.mutate(config);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo, config, canWrite, saveMutation, jsonError]);

    // When a component is added, switch layers tab so user can see it
    // (handled by selectComponent in store — no extra work needed)

    if (isLoading)
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin" />
            </div>
        );
    if (!config) return <div className="p-10">Failed to load configuration.</div>;

    return (
        <div className="flex h-screen w-full flex-col overflow-hidden bg-gray-50">
            {/* Top Bar */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
                <div className="flex items-center gap-4">
                    <h2 className="font-semibold">Page Editor: {tagName}</h2>
                    {/* Mode Toggle */}
                    <div className="flex rounded-lg border bg-gray-100 p-0.5">
                        <Button
                            variant={activeTab === 'visual' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('visual')}
                            className="gap-1"
                        >
                            <LayoutTemplate className="size-4" />
                            Visual
                        </Button>
                        <Button
                            variant={activeTab === 'json' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('json')}
                            className="gap-1"
                        >
                            <Code className="size-4" />
                            JSON
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Draft / live status */}
                    {hasDraft || isDirty ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                            <span className="size-2 rounded-full bg-amber-500" />
                            {isDirty ? 'Unsaved changes' : 'Draft — not published'}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-600">
                            <span className="size-2 rounded-full bg-green-500" />
                            Live
                        </span>
                    )}
                    {/* Undo/Redo */}
                    <div className="flex rounded-lg border bg-gray-100 p-0.5">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={undo}
                            disabled={!canUndo()}
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 className="size-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={redo}
                            disabled={!canRedo()}
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo2 className="size-4" />
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(true)}
                        title="Version history"
                        disabled={!catalogueId}
                    >
                        <ClockCounterClockwise className="size-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveMutation.mutate(config)}
                        disabled={saveMutation.isPending || publishMutation.isPending || !canWrite || !!jsonError || !catalogueId}
                    >
                        <Save className="mr-2 size-4" />
                        Save draft
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => publishMutation.mutate()}
                        disabled={
                            publishMutation.isPending || saveMutation.isPending || !canWrite || !!jsonError || !catalogueId ||
                            (!hasDraft && !isDirty)
                        }
                        title="Make this version live for learners"
                    >
                        {publishMutation.isPending ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                            <RocketLaunch className="mr-2 size-4" />
                        )}
                        Publish
                    </Button>
                </div>
            </div>

            {/* Version history */}
            <RevisionHistoryDialog
                open={showHistory}
                onOpenChange={setShowHistory}
                catalogueId={catalogueId}
                onRestore={(json) => {
                    try {
                        const parsed = JSON.parse(json) as CatalogueConfig;
                        updateConfig(parsed);
                        // Restored config may not contain the selected page —
                        // reselect so the canvas doesn't go blank.
                        if (!parsed.pages.some((p) => p.id === selectedPageId) && parsed.pages[0]) {
                            selectPage(parsed.pages[0].id);
                        }
                    } catch (e) {
                        console.error('Failed to parse revision JSON', e);
                    }
                }}
            />

            {/* Main Content */}
            {activeTab === 'json' ? (
                /* JSON Editor Mode */
                <div className="flex flex-1 flex-col overflow-hidden bg-gray-900 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm text-gray-400">Edit JSON Configuration</span>
                        {jsonError && (
                            <span className="rounded bg-red-500 px-2 py-1 text-xs text-white">
                                {jsonError}
                            </span>
                        )}
                    </div>
                    <Textarea
                        value={jsonText}
                        onChange={(e) => handleJsonChange(e.target.value)}
                        className="flex-1 resize-none bg-gray-800 font-mono text-sm text-green-400"
                        spellCheck={false}
                    />
                </div>
            ) : (
                /* Visual Editor Mode — direct-DOM canvas */
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="flex flex-1 overflow-hidden">
                        {/* Left Sidebar */}
                        <div className="flex w-64 flex-col border-r bg-white">
                            {/* Three-tab strip */}
                            <div className="flex shrink-0 border-b">
                                <button
                                    onClick={() => setSidebarTab('components')}
                                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                                        sidebarTab === 'components'
                                            ? 'border-b-2 border-blue-500 text-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="Components"
                                >
                                    <PuzzleIcon className="size-3.5" />
                                    Add
                                </button>
                                <button
                                    onClick={() => setSidebarTab('layers')}
                                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                                        sidebarTab === 'layers'
                                            ? 'border-b-2 border-blue-500 text-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="Layers — current page structure"
                                >
                                    <List className="size-3.5" />
                                    Layers
                                </button>
                                <button
                                    onClick={() => setSidebarTab('templates')}
                                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                                        sidebarTab === 'templates'
                                            ? 'border-b-2 border-blue-500 text-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="Page templates"
                                >
                                    <Layers className="size-3.5" />
                                    Templates
                                </button>
                            </div>

                            {/* Sidebar content */}
                            <div className="flex flex-1 flex-col overflow-hidden">
                                {sidebarTab === 'components' && <ComponentLibrary />}
                                {sidebarTab === 'layers' && <LayersPanel />}
                                {sidebarTab === 'templates' && <TemplateLibrary />}
                            </div>
                        </div>

                        {/* Center — Direct-DOM canvas + page tabs */}
                        <div className="flex flex-1 flex-col overflow-hidden">
                            <div className="flex-1 overflow-hidden">
                                <CanvasRenderer tagName={tagName} />
                            </div>
                            {/* Bottom — Page Tabs */}
                            <div className="h-12 shrink-0 border-t bg-white">
                                <PageTabs />
                            </div>
                        </div>

                        {/* Right Sidebar — Properties / AI copilot */}
                        <div className="flex w-80 flex-col overflow-hidden border-l bg-white">
                            <div className="flex shrink-0 border-b">
                                <button
                                    onClick={() => setRightTab('properties')}
                                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                                        rightTab === 'properties'
                                            ? 'border-b-2 border-blue-500 text-blue-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Properties
                                </button>
                                <button
                                    onClick={() => setRightTab('ai')}
                                    className={`flex flex-1 items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                                        rightTab === 'ai'
                                            ? 'border-b-2 border-primary-500 text-primary-500'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <Sparkle className="size-3.5" weight="duotone" />
                                    AI
                                </button>
                            </div>
                            {rightTab === 'properties' ? (
                                <div className="flex-1 overflow-auto">
                                    <PropertyPanel />
                                </div>
                            ) : (
                                <AiCopilotPanel />
                            )}
                        </div>
                    </div>

                    {/* Floating drag ghost */}
                    <DragOverlay dropAnimation={null}>
                        {activeDragLabel && (
                            <div className="pointer-events-none z-50 rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-xl">
                                + {activeDragLabel}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    );
};
