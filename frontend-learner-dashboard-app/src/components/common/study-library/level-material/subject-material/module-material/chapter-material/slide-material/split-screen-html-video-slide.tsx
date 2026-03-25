/* eslint-disable */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CodeEditorSlide } from "./code-editor-slide";
import { JupyterNotebookSlide } from "./jupyter-notebook-slide";
import { ScratchProjectSlide } from "./scratch-project-slide";
import { AIVideoPlayer } from "@/components/ai-video-player";
import { DotsSixVertical } from "@phosphor-icons/react";


interface SplitScreenHtmlVideoSlideProps {
    videoId: string;
    videoUrls: {
        htmlUrl: string;
        audioUrl: string;
    };
    embeddedContent?: {
        embedded_type: "CODE" | "SCRATCH" | "JUPYTER";
        embedded_data: string;
        questions?: unknown[];
    };
    status?: string;
    onTimeUpdate?: () => void;
    documentId: string;
}

export const SplitScreenHtmlVideoSlide: React.FC<SplitScreenHtmlVideoSlideProps> = ({
    videoId,
    videoUrls,
    embeddedContent,
    status,
    onTimeUpdate,
    documentId,
}) => {
    const [leftWidth, setLeftWidth] = useState(50); // Percentage width for left panel
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth =
            ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Constrain between 20% and 80%
        const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
        setLeftWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
    }, [isDragging]);

    const renderEmbeddedSlide = () => {
        if (!embeddedContent?.embedded_type || !embeddedContent?.embedded_data) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="text-neutral-500">No embedded content</div>
                </div>
            );
        }

        switch (embeddedContent.embedded_type) {
            case "CODE":
                return (
                    <CodeEditorSlide
                        published_data={embeddedContent.embedded_data}
                        documentId={documentId}
                    />
                );
            case "JUPYTER":
                return (
                    <JupyterNotebookSlide
                        published_data={embeddedContent.embedded_data}
                        documentId={documentId}
                    />
                );
            case "SCRATCH":
                return (
                    <ScratchProjectSlide
                        published_data={embeddedContent.embedded_data}
                        documentId={documentId}
                    />
                );
            default:
                return (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-neutral-500">Unsupported embedded type</div>
                    </div>
                );
        }
    };

    const videoContent = useMemo(() => {
        return (
            <div className="h-full w-full bg-white rounded-lg overflow-hidden flex flex-col">
                {/* Container for the video player */}
                <div className="flex-1 w-full h-full relative">
                    <AIVideoPlayer
                        timelineUrl={videoUrls.htmlUrl}
                        audioUrl={videoUrls.audioUrl}
                        className="w-full h-full"
                    />
                </div>
            </div>
        );
    }, [videoUrls]);

    return (
        <div className="h-full p-1">
            <Card className="h-full flex flex-col">
                {/* Split Screen Content */}
                <div className="flex-1 relative overflow-hidden" ref={containerRef}>
                    <div className="flex flex-col lg:flex-row h-full">
                        {/* Left Panel - Embedded Content (Top on mobile, Left on desktop) */}
                        <div
                            className="relative overflow-hidden lg:border-r border-neutral-200"
                            style={{
                                width: window.innerWidth >= 1024 ? `${leftWidth}%` : "100%",
                                height: window.innerWidth >= 1024 ? "100%" : "50%",
                            }}
                        >
                            <div className="h-full">{renderEmbeddedSlide()}</div>
                        </div>

                        {/* Resizer - Only show on desktop */}
                        {window.innerWidth >= 1024 && (
                            <div
                                className={`relative flex items-center justify-center w-2 bg-neutral-100 hover:bg-neutral-200 cursor-col-resize transition-colors group ${isDragging ? "bg-primary-200" : ""
                                    }`}
                                onMouseDown={handleMouseDown}
                            >
                                <div className="absolute inset-y-0 w-4 -mx-1" />
                                <DotsSixVertical
                                    size={16}
                                    className={`text-neutral-400 group-hover:text-neutral-600 transition-colors ${isDragging ? "text-primary-600" : ""
                                        }`}
                                />
                            </div>
                        )}

                        {/* Right Panel - Video (Bottom on mobile, Right on desktop) */}
                        <div
                            className="relative overflow-hidden"
                            style={{
                                width:
                                    window.innerWidth >= 1024 ? `${100 - leftWidth}%` : "100%",
                                height: window.innerWidth >= 1024 ? "100%" : "50%",
                            }}
                        >
                            <div className="h-full">
                                {/* Removed inner padding to let video fill */}
                                {videoContent || (
                                    <div className="flex items-center justify-center h-full bg-neutral-100 rounded-lg">
                                        <div className="text-neutral-500">Loading video...</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Drag Overlay - Only show on desktop */}
                    {isDragging && window.innerWidth >= 1024 && (
                        <div className="absolute inset-0 bg-transparent cursor-col-resize z-10" />
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-neutral-200 px-4 py-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                        <div className="flex items-center gap-4">
                            <span>Layout: Split Screen</span>
                            <span>Left: {embeddedContent?.embedded_type || "Content"}</span>
                            <span>Right: HTML Video</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                Interactive
                            </span>
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                Resizable
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
