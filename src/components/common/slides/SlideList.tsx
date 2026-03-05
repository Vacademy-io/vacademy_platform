/* eslint-disable */
// @ts-nocheck
'use client';

import React, { useState, useEffect, memo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { exportToSvg } from '@excalidraw/excalidraw';
import { GripVertical, Presentation, Trash2, ImageOff, AlertTriangle } from 'lucide-react';
import { ExportIcon, ImportIcon } from './Icons';
import { SlideTypeSheet } from '../slides/slideTypeSheet';
import type {
    Slide as AppSlide,
    ExcalidrawSlideData,
    QuizSlideData,
    FeedbackSlideData,
    PartialAppState,
} from './types';
import { SlideTypeEnum } from '././utils/types';
import { QuzizIcon, feedbackIcon } from '@/svgs';

interface SlideListProps {
    slides: AppSlide[];
    currentSlideId: string | undefined;
    onSlideChange: (id: string) => void;
    onAddSlide: (type: SlideTypeEnum) => void;
    onDeleteSlide: (id: string) => void;
    onExport: () => void;
    onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onReorderSlides: (newSlides: AppSlide[]) => void;
    onAiGenerateClick: () => void;
}

interface PreviewProps {
    slide: AppSlide;
}

function stripHtml(html: string): string {
    if (typeof document === 'undefined') return html;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
}

const SlideTypePreview = memo(({ slide }: PreviewProps) => {
    const [svg, setSvg] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setPreviewError(false);
        setSvg(null);

        const generateThumbnail = async () => {
            if (slide.type === SlideTypeEnum.Quiz || slide.type === SlideTypeEnum.Feedback) {
                return;
            }
            const excalidrawSlide = slide as ExcalidrawSlideData;
            if (!excalidrawSlide.elements || excalidrawSlide.elements.length === 0) {
                if (isMounted) setSvg(null);
                return;
            }
            try {
                const appStateForExport: PartialAppState & {
                    exportWithDarkMode: boolean;
                    viewBackgroundColor: string;
                    theme: string;
                    exportEmbedScene: boolean;
                } = {
                    ...(excalidrawSlide.appState || {}),
                    exportEmbedScene: true,
                    exportWithDarkMode: false,
                    viewBackgroundColor: excalidrawSlide.appState?.viewBackgroundColor || '#FFFFFF',
                    theme: 'light',
                };
                const svgElement = await exportToSvg({
                    elements: excalidrawSlide.elements,
                    appState: appStateForExport,
                    files: excalidrawSlide.files || null,
                });
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                const serializer = new XMLSerializer();
                let svgStr = serializer.serializeToString(svgElement);
                if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
                    svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
                if (isMounted) setSvg(dataUrl);
            } catch (error) {
                console.error('Error generating Excalidraw thumbnail for slide:', slide.id, error);
                if (isMounted) {
                    setSvg(null);
                    setPreviewError(true);
                }
            }
        };
        generateThumbnail();
        return () => {
            isMounted = false;
        };
    }, [slide]);

    const commonPreviewContainerClass =
        'h-full w-full rounded-md flex flex-col items-center justify-center p-1 text-xs overflow-hidden';
    const commonImageContainerClass =
        'h-full w-full rounded-md bg-white overflow-hidden border flex items-center justify-center';
    const commonTitleClass = 'text-sm text-center font-medium truncate w-full px-1 py-0.5';
    const placeholderIconClass = 'mb-1 h-6 w-6 text-gray-400';

    const renderPlaceholder = (text: string, icon?: React.ReactNode) => (
        <div className={cn(commonPreviewContainerClass, 'border border-gray-200 bg-gray-50')}>
            {icon || <Presentation className={placeholderIconClass} />}
            <div className="text-center text-gray-500">{text}</div>
        </div>
    );

    if (previewError && slide.type !== SlideTypeEnum.Quiz && slide.type !== SlideTypeEnum.Feedback) {
        return renderPlaceholder('Preview Error', <AlertTriangle className={cn(placeholderIconClass, 'text-red-400')} />);
    }

    switch (slide.type) {
        case SlideTypeEnum.Quiz: {
            const quizSlide = slide as QuizSlideData;
            return (
                <div className={cn(commonPreviewContainerClass, 'border border-orange-200 bg-orange-50 justify-center')}>
                    {quizSlide.elements?.questionName ? (
                        <div className={cn(commonTitleClass, 'text-orange-700 break-words whitespace-normal line-clamp-3')}>
                            {stripHtml(quizSlide.elements.questionName)}
                        </div>
                    ) : (
                        <div className={cn(commonTitleClass, 'text-orange-700 opacity-75')}>
                            Quiz
                        </div>
                    )}
                </div>
            );
        }
        case SlideTypeEnum.Feedback: {
            const feedbackSlide = slide as FeedbackSlideData;
            return (
                <div className={cn(commonPreviewContainerClass, 'border border-sky-200 bg-sky-50 justify-center')}>
                    {feedbackSlide.elements?.questionName ? (
                        <div className={cn(commonTitleClass, 'text-sky-700 break-words whitespace-normal line-clamp-3')}>
                            {stripHtml(feedbackSlide.elements.questionName)}
                        </div>
                    ) : (
                        <div className={cn(commonTitleClass, 'text-sky-700 opacity-75')}>
                            Feedback
                        </div>
                    )}
                </div>
            );
        }
        default: {
            const excalidrawSlide = slide as ExcalidrawSlideData;
            if (svg) {
                return (
                    <div className={cn(commonImageContainerClass, 'border-gray-200')}>
                        <img
                            src={svg}
                            alt="Slide thumbnail"
                            className="pointer-events-none h-full w-full bg-white object-contain"
                            onError={() => {
                                setSvg(null);
                                setPreviewError(true);
                            }}
                        />
                    </div>
                );
            }
            if (!excalidrawSlide.elements || excalidrawSlide.elements.length === 0) {
                return renderPlaceholder(
                    slide.type === SlideTypeEnum.Title
                        ? 'Title (Empty)'
                        : slide.type === SlideTypeEnum.Text
                          ? 'Text (Empty)'
                          : 'Blank Slide',
                    <ImageOff className={placeholderIconClass} />
                );
            }
            return renderPlaceholder(
                slide.type === SlideTypeEnum.Title
                    ? 'Title Slide'
                    : slide.type === SlideTypeEnum.Text
                      ? 'Text Slide'
                      : 'Drawing'
            );
        }
    }
});
SlideTypePreview.displayName = 'SlideTypePreview';

const SlideList = ({
    slides,
    currentSlideId,
    onSlideChange,
    onAddSlide,
    onDeleteSlide,
    onExport,
    onImport,
    onReorderSlides,
    onAiGenerateClick,
}: SlideListProps) => {
    const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);

    const handleSelectSlideType = (type: SlideTypeEnum) => {
        onAddSlide(type);
        setIsTypeSheetOpen(false);
    };

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || result.source.index === result.destination.index) return;

        const reordered = Array.from(slides);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);
        onReorderSlides(reordered);
    };

    return (
        <>
            <div className="flex h-full w-72 flex-col bg-white p-3 shadow-sm">
                <div className="flex flex-col gap-y-2 pb-2 pt-1">
                    <Button
                        onClick={() => setIsTypeSheetOpen(true)}
                        className="w-full gap-2 bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 focus-visible:ring-orange-400"
                    >
                        <span className="mr-0.5 text-lg font-semibold leading-none">+</span> Add
                        Slide
                    </Button>
                    <Button
                        onClick={onAiGenerateClick}
                        variant="outline"
                        className="w-full gap-2 border-blue-500 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-blue-400"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-5 w-5"
                        >
                            <path
                                fillRule="evenodd"
                                d="M9 4.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 019 4.5zm5.707 2.293a.75.75 0 01.043 1.06l-1.72 1.965a.75.75 0 01-1.102-.043l-1.72-1.965a.75.75 0 111.102-1.017l1.168 1.335 1.168-1.335a.75.75 0 011.06-.043zM3 10.5a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm17.25.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 000 1.5h1.5a.75.75 0 00.75-.75zM14.25 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zm-5.25.75a.75.75 0 00-.75-.75v-1.5a.75.75 0 00-1.5 0v1.5a.75.75 0 00.75.75z"
                                clipRule="evenodd"
                            />
                            <path d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm-3.75 8.25v-.012a.75.75 0 01.75-.75h6a.75.75 0 01.75.75v.012a.75.75 0 01-.75.75h-6a.75.75 0 01-.75-.75z" />
                        </svg>
                        Generate with AI
                    </Button>
                </div>
                <Separator className="my-3 bg-gray-200" />
                <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-base font-semibold text-gray-700">Slides</h2>
                    <div className="flex gap-1">
                        <button
                            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                            onClick={onExport}
                            title="Export Volt"
                        >
                            <ExportIcon width={18} height={18} />
                        </button>
                        <label className="cursor-pointer rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
                            <ImportIcon width={18} height={18} />
                            <input
                                type="file"
                                onChange={onImport}
                                className="sr-only"
                                accept=".excalidraw,application/json"
                            />
                        </label>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="scrollbar-thin scrollbar-thumb-slate-300 h-full rounded-md">
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="slides">
                                {(provided) => (
                                    <ul
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="space-y-2"
                                    >
                                        {slides.map((slide, index) => (
                                            <Draggable
                                                key={slide.id}
                                                draggableId={slide.id}
                                                index={index}
                                            >
                                                {(providedDraggable, snapshot) => (
                                                    <li
                                                        ref={providedDraggable.innerRef}
                                                        {...providedDraggable.draggableProps}
                                                        className={cn(
                                                            'group relative overflow-hidden mb-2 flex flex-col cursor-pointer rounded-lg border bg-white p-1.5 shadow-sm transition-all duration-150 ease-in-out hover:border-orange-400 hover:bg-orange-50/30 hover:shadow-md h-28',
                                                            {
                                                                'border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-500 ring-offset-1':
                                                                    slide.id === currentSlideId,
                                                                'border-slate-200': slide.id !== currentSlideId, 
                                                            }
                                                        )}
                                                        onClick={() => onSlideChange(slide.id)}
                                                    >
                                                        <div className="pointer-events-none flex-1"> {/* Ensure preview takes space */}
                                                            <SlideTypePreview slide={slide} />
                                                        </div>
                                                        {/* CONTROLS BAR - Ensure classes are correct for hover visibility */}
                                                        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-md border-t border-gray-200 bg-gray-50/80 px-1.5 py-1 transition-all duration-150 z-10 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                                                            <div
                                                                {...providedDraggable.dragHandleProps}
                                                                className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
                                                            >
                                                                <GripVertical className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-500">
                                                                {index + 1}
                                                            </span>
                                                            <button
                                                                className="rounded p-1 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent li's onClick
                                                                    onDeleteSlide(slide.id);
                                                                }}
                                                                title="Delete slide"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </li>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </ul>
                                )}
                            </Droppable>
                        </DragDropContext>
                    </ScrollArea>
                </div>
            </div>

            <SlideTypeSheet
                open={isTypeSheetOpen}
                onOpenChange={setIsTypeSheetOpen}
                onSelectType={handleSelectSlideType}
            />
        </>
    );
};

export default memo(SlideList);
