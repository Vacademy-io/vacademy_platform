import { useQuery, useMutation } from '@tanstack/react-query';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getCatalogueConfig, saveCatalogueConfig } from '../-services/catalogue-service';
import { useEditorStore } from '../-stores/editor-store';
import React, { useEffect, useState } from 'react';
import { ComponentLibrary } from './ComponentLibrary';
import { TemplateLibrary } from './TemplateLibrary';
import { LayersPanel } from './LayersPanel';
import { PropertyPanel } from './PropertyPanel';
import { PageTabs } from './PageTabs';
import { CanvasRenderer } from './CanvasRenderer';
import { Button } from '@/components/ui/button';
import {
    Loader2, Save, Code, LayoutTemplate, Undo2, Redo2,
    Layers, PuzzleIcon, List,
} from 'lucide-react';
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
    const [savedConfigJSON, setSavedConfigJSON] = useState('');
    const isDirty = config ? JSON.stringify(config) !== savedConfigJSON : false;

    const { data, isLoading } = useQuery({
        queryKey: ['catalogueConfig', instituteId, tagName],
        queryFn: () => getCatalogueConfig(instituteId!, tagName),
        enabled: !!instituteId && !!tagName,
    });

    const saveMutation = useMutation({
        mutationFn: (newConfig: CatalogueConfig) =>
            saveCatalogueConfig(instituteId!, tagName, newConfig),
        onSuccess: (_, savedConfig) => {
            setSavedConfigJSON(JSON.stringify(savedConfig));
            toast({ title: 'Saved', description: 'Changes saved successfully' });
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

    useEffect(() => {
        if (data && data.catalogue_json) {
            try {
                const parsed = JSON.parse(data.catalogue_json);
                setConfig(parsed);
                setSavedConfigJSON(data.catalogue_json);
            } catch (e) {
                console.error('Failed to parse catalogue JSON', e);
            }
        }
    }, [data, setConfig]);

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
                if (config && canWrite && !saveMutation.isPending && !jsonError) {
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
                    {/* Unsaved indicator */}
                    {isDirty && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600">
                            <span className="size-2 rounded-full bg-amber-500" />
                            Unsaved changes
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
                        size="sm"
                        onClick={() => saveMutation.mutate(config)}
                        disabled={saveMutation.isPending || !canWrite || !!jsonError}
                    >
                        <Save className="mr-2 size-4" />
                        Save
                    </Button>
                </div>
            </div>

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

                        {/* Right Sidebar — Properties */}
                        <div className="flex w-80 flex-col overflow-auto border-l bg-white">
                            <div className="border-b p-4 font-medium">Properties</div>
                            <PropertyPanel />
                        </div>
                    </div>

                    {/* Floating drag ghost */}
                    <DragOverlay dropAnimation={null}>
                        {activeDragLabel && (
                            <div className="pointer-events-none z-[9999] rounded-lg border-2 border-blue-400 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-xl">
                                + {activeDragLabel}
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    );
};
