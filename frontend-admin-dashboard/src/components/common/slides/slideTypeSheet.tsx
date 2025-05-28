"use client"

import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Search, Youtube, Link2, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"
import { FileQuestion, GraduationCap, MessageSquare, Presentation } from "lucide-react"
import { SlideType } from "./constant/slideType"

interface SlideTypeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectType: (type: SlideType) => void
}

export function SlideTypeSheet({ open, onOpenChange, onSelectType }: SlideTypeSheetProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const basicSlideTypes = [
    { id: SlideType.Blank, name: "Blank slide", icon: null  , isNew: false},
    { id: SlideType.Title, name: "Title Slide", icon: null, isNew: false },
    { id: SlideType.Text, name: "Text Slide", icon: null , isNew: false},
    { id: SlideType.TextMedia, name: "Text and media", icon: <QrCode className="h-6 w-6 text-gray-500" /> , isNew: false},
    { id: SlideType.FullscreenMedia, name: "Fullscreen media", icon: <Youtube className="h-6 w-6 text-gray-500" /> , isNew: false},
    { id: SlideType.WebLink, name: "Web page link", icon: <Link2 className="h-6 w-6 text-gray-500" /> , isNew: false},
  ]

  const interactiveSlideTypes = [
    { id: SlideType.Quiz, name: "Quiz", icon: <FileQuestion className="mr-2 h-4 w-4" />  , isNew: false},
    // { id: SlideType.LMS, name: "LMS", icon: <GraduationCap className="mr-2 h-4 w-4" /> },
    { id: SlideType.Feedback, name: "Feedback", icon: <MessageSquare className="mr-2 h-4 w-4" />, isNew: true },
  ]

  const advancedSlideTypes = [
    { id: SlideType.Presentation, name: "Presentation", icon: <Presentation className="mr-2 h-4 w-4" /> , isNew: false},
    {
      id: SlideType.InteractiveVideo,
      name: "Interactive Video",
      icon: <Youtube className="h-6 w-6 text-gray-500" />,
      isNew: true,
    },
  ]

  const allSlideTypes = [...basicSlideTypes, ...interactiveSlideTypes, ...advancedSlideTypes]
  const filteredSlideTypes = allSlideTypes.filter((type) => type.name.toLowerCase().includes(searchQuery.toLowerCase()))

  // Function to render a section of slide types
  const renderSlideTypeSection = (slideTypes:any, sectionTitle:any) => {
    const filteredTypes = searchQuery
      ? slideTypes.filter((type:any) => type.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : slideTypes

    if (searchQuery && filteredTypes.length === 0) {
      return null
    }

    return (
      <div className="mb-8">
        <h3 className="mb-3 text-gray-700 font-medium">{sectionTitle}</h3>
        <div className="grid grid-cols-2 gap-3">
          {filteredTypes.map((type:any) => (
            <div
              key={type.id}
              className="relative cursor-pointer rounded-md border border-primary-300 p-3 hover:border-primary-400 hover:bg-primary-100"
              onClick={() => onSelectType(type.id as SlideType)}
            >
              <div className="flex h-16 flex-col items-center justify-center">
                {type.icon ? (
                  type.icon
                ) : (
                  <div
                    className={cn(
                      "h-12 w-full rounded-md bg-gray-200",
                      type.id === "title" && "flex flex-col justify-center",
                      type.id === "text" && "flex flex-col justify-between",
                    )}
                  >
                    {type.id === "title" && <div className="mx-auto h-2 w-3/4 bg-gray-300 rounded"></div>}
                    {type.id === "text" && (
                      <>
                        <div className="h-2 w-full bg-gray-300 rounded mt-2"></div>
                        <div className="h-2 w-full bg-gray-300 rounded mb-2"></div>
                      </>
                    )}
                    {type.id === "text-media" && (
                      <>
                        <div className="h-2 w-3/4 bg-gray-300 rounded mt-2"></div>
                        <div className="absolute right-6 top-8 h-8 w-8 bg-gray-300 rounded flex items-center justify-center">
                          <QrCode className="h-4 w-4 text-gray-400" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-sm">{type.name}</p>
              {type.isNew && (
                <span className="absolute -top-2 -left-2 rounded-full bg-purple-500 px-2 py-0.5 text-xs text-white">
                  New
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[400px] overflow-y-auto" side="left">
        <SheetHeader>
          <SheetTitle className="text-xl">Select Slide</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search..."
              className="pl-9 pr-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mt-6">
            {searchQuery ? (
              filteredSlideTypes.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {filteredSlideTypes.map((type) => (
                    <div
                      key={type.id}
                      className="relative cursor-pointer rounded-md border border-primary-300 p-3 hover:border-primary-400 hover:bg-primary-100"
                      onClick={() => onSelectType(type.id as SlideType)}
                    >
                      <div className="flex h-16 flex-col items-center justify-center">
                        {type.icon ? (
                          type.icon
                        ) : (
                          <div
                            className={cn(
                              "h-12 w-full rounded-md bg-gray-200",
                              type.id === "title" && "flex flex-col justify-center",
                              type.id === "text" && "flex flex-col justify-between",
                            )}
                          >
                            {type.id === "title" && <div className="mx-auto h-2 w-3/4 bg-gray-300 rounded"></div>}
                            {type.id === "text" && (
                              <>
                                <div className="h-2 w-full bg-gray-300 rounded mt-2"></div>
                                <div className="h-2 w-full bg-gray-300 rounded mb-2"></div>
                              </>
                            )}
                            {type.id === "text-media" && (
                              <>
                                <div className="h-2 w-3/4 bg-gray-300 rounded mt-2"></div>
                                <div className="absolute right-6 top-8 h-8 w-8 bg-gray-300 rounded flex items-center justify-center">
                                  <QrCode className="h-4 w-4 text-gray-400" />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-center text-sm">{type.name}</p>
                      
                      {type?.isNew && (
                        <span className="absolute -top-2 -left-2 rounded-full bg-purple-500 px-2 py-0.5 text-xs text-white">
                          New
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 mt-8">No slide types match your search</p>
              )
            ) : (
              <>
                {renderSlideTypeSection(basicSlideTypes, "Basic Slides")}
                {renderSlideTypeSection(interactiveSlideTypes, "Interactive Content")}
                {renderSlideTypeSection(advancedSlideTypes, "Advanced Features")}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

