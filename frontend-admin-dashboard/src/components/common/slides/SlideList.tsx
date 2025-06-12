/* eslint-disable */
// @ts-nocheck
"use client"

import React, { useState, useEffect } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ExportIcon, ImportIcon } from "./Icons"
import { SlideTypeSheet } from "./slideTypeSheet"
import {
  GripVertical,
  QrCode,
  Youtube,
  Link2,
  FileQuestion,
  MessageSquare,
  Presentation,
  Trash2,
} from "lucide-react"
import type { Slide } from "./types"
import type { SlideType } from "./constant/slideType"
import { SlideType as SlideTypeEnum } from "./constant/slideType"
import { ScrollArea } from "@/components/ui/scroll-area"
import { exportToSvg } from "@excalidraw/excalidraw"
import { QuzizIcon, feedbackIcon } from "@/svgs"

interface SlideListProps {
  slides: Slide[]
  currentSlide: string | undefined
  onSlideChange: (id: string) => void
  onAddSlide: (type: SlideType) => void
  onMoveSlideUp: () => void
  onMoveSlideDown: () => void
  onDeleteSlide: (id: string) => void
  onExport: () => void
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void
  onReorderSlides: (newSlides: Slide[]) => void
}

interface PreviewProps {
  slide: Slide
}


function stripHtml(html: string) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || "";
}

const SlideTypePreview = React.memo(({ slide }: PreviewProps) => {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const generateThumbnail = async () => {
      try {
        // For Excalidraw slides
        if (![SlideTypeEnum.Feedback, SlideTypeEnum.Quiz].includes(slide.type)) {
          const svgElement = await exportToSvg({
            elements: slide.elements || [],
            appState: {
              ...slide.appState,
              exportEmbedScene: true,
              exportWithDarkMode: false,
              viewBackgroundColor: "#ffffff",
            },
            files: slide.files || null,
          })

          // Set dimensions for thumbnail
          svgElement.setAttribute("width", "100%")
          svgElement.setAttribute("height", "80")

          // Convert to data URL
          const serializer = new XMLSerializer()
          let svgStr = serializer.serializeToString(svgElement)

          // Fix potential xmlns issues
          if (!svgStr.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
          }

          const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`
          if (isMounted) setSvg(dataUrl)
        }
      } catch (error) {
        console.error("Error generating thumbnail:", error)
        if (isMounted) setSvg(null)
      }
    }

    generateThumbnail()

    return () => {
      isMounted = false
    }
  }, [slide])

  switch (slide.type) {
    case SlideTypeEnum.Quiz:
      return (
        <div className="relative h-16 w-full rounded-t-md bg-indigo-50 flex flex-col items-center justify-center p-2">
          <div className="h-16 w-full rounded-t-md bg-white overflow-hidden border-b">
          {slide.elements?.questionName && (
            <div className="text-xs text-center font-medium text-indigo-800 truncate w-full px-1">
              {stripHtml(slide.elements.questionName)}
            </div>
          )}
            <img
              src={QuzizIcon}
              alt="Slide thumbnail"
              className="w-full h-full object-contain bg-white pointer-events-none"
              onError={() => setSvg(null)}
            />
          </div>
         
        </div>
      )
    case SlideTypeEnum.Feedback:
      return (
        <div className="relative h-16 w-full rounded-t-md bg-teal-50 flex flex-col items-center justify-center p-2">
          <div className="h-16 w-full rounded-t-md bg-white overflow-hidden border-b">
          {slide.elements?.questionName && (
            <div className="text-xs text-center font-medium text-teal-800 truncate w-full px-1">
               {stripHtml(slide.elements.questionName)}
            </div>
          )}
            <img
              src={feedbackIcon}
              alt="Slide thumbnail"
              className="w-full h-full object-contain bg-white pointer-events-none"
              onError={() => setSvg(null)}
            />
          </div>
          
        </div>
      )
    default:
      return svg ? (
        <div className="h-16 w-full rounded-t-md bg-white overflow-hidden border-b">
          <img
            src={svg}
            alt="Slide thumbnail"
            className="w-full h-full object-contain bg-white pointer-events-none"
            onError={() => setSvg(null)}
          />
        </div>
      ) : (
        <div className="h-16 w-full rounded-t-md bg-gray-100 flex flex-col items-center justify-center">
          <Presentation className="h-5 w-5 text-gray-400 mb-1" />
          <div className="text-xs text-gray-500">
            {slide.type === SlideTypeEnum.Title ? "Title" :
              slide.type === SlideTypeEnum.Text ? "Text" : "Blank"}
          </div>
        </div>
      )
  }
})

SlideTypePreview.displayName = "SlideTypePreview"

const SlideList = ({
  slides,
  currentSlide,
  onSlideChange,
  onAddSlide,
  onMoveSlideUp,
  onMoveSlideDown,
  onDeleteSlide,
  onExport,
  onImport,
  onReorderSlides,
}: SlideListProps) => {
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false)

  const handleSelectSlideType = (type: SlideType) => {
    onAddSlide(type)
    setIsTypeSheetOpen(false)
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const reordered = Array.from(slides)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)

    onReorderSlides(reordered)
    localStorage.setItem("slides", JSON.stringify(reordered))
  }

  return (
    <>
      <div className="flex w-60 flex-col rounded-xl bg-primary-100 p-3 border border-gray-200 shadow-sm">
        <div className="pt-3">
          <Button
            onClick={() => setIsTypeSheetOpen(true)}
            className="w-full gap-2 bg-primary-400 hover:bg-primary-500"
          >
            <span className="mr-1">+</span> Add Slide
          </Button>
        </div>

        <Separator className="my-3 bg-gray-200" />

        <div className="mb-3 flex justify-between items-center">
          <h2 className="text-lg font-semibold p-1">Slides</h2>
          <div className="flex gap-2">
            <button
              className="rounded p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
              onClick={onExport}
              title="Export"
            >
              <ExportIcon width={18} />
            </button>
            <label className="cursor-pointer rounded p-1 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors">
              <ImportIcon width={18} />
              <input
                type="file"
                onChange={onImport}
                className="sr-only"
                accept=".edslides,application/json"
              />
            </label>
          </div>
        </div>

        <div className="flex-1">
          <ScrollArea className="h-[calc(100vh-220px)] rounded-md">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="slides">
                {(provided) => (
                  <ul
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-3 p-4"
                  >
                    {slides.map((slide, index) => (
                      <Draggable
                        key={slide.id}
                        draggableId={slide.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "group relative rounded-lg transition-all cursor-pointer bg-white shadow-sm",
                              snapshot.isDragging
                                ? "shadow-lg ring-2 ring-primary-500 z-10"
                                : "hover:shadow-md",
                              slide.id === currentSlide
                                ? "ring-2 ring-primary-500"
                                : "ring-1 ring-gray-200 hover:ring-gray-300"
                            )}
                            onClick={() => onSlideChange(slide.id)}
                          >
                            <SlideTypePreview slide={slide} />
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-b-lg border-t">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab hover:bg-gray-100 p-1 rounded text-gray-500 hover:text-gray-700"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-medium text-gray-500">
                                {index + 1}
                              </span>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-gray-500 hover:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteSlide(slide.id)
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
  )
}

export default React.memo(SlideList)