// SlidesEditor.tsx
/* eslint-disable */
// @ts-nocheck
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { SlideEditor } from "./SlideEditor";
import { Button } from "@/components/ui/button";
import { ListStart, Settings, FileDown, Save, Loader2 } from "lucide-react";
import SlideList from "./SlideList";
import { SlideType } from "./constant/slideType";
import { QuizeSlide } from "./slidesTypes/QuizSlides";
import { useSlideStore } from "@/stores/Slides/useSlideStore";
import { ADD_PRESENTATION, EDIT_PRESENTATION } from "@/constants/urls";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { TokenKey } from "@/constants/auth/tokens";
import { StatusCode, UploadFileInS3V2 } from "@/services/upload_file";
import { useRouter } from "@tanstack/react-router";
import { useGetSinglePresentation } from "./hooks/useGetSinglePresntation";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";
import { toast } from "sonner";
import { IoArrowBackSharp } from "react-icons/io5";
import html2canvas from "html2canvas";
import { filterSlidesByIdType } from "./utils/util";

const SlideRenderer = ({
  type,
  currentSlideId,
  editMode,

}: {
  type: SlideType;
  currentSlideId: string;
  editMode: boolean
}) => {
  const getSlide = useSlideStore(state => state.getSlide);
  const updateSlide = useSlideStore(state => state.updateSlide);
  const slide = getSlide(currentSlideId);

  if (!slide) return null;

  switch (type) {
    case SlideType.Quiz:
    case SlideType.Feedback:
      return <QuizeSlide formdata={slide.elements} className={"flex flex-col"} questionType={type} currentSlideId={currentSlideId} key={currentSlideId} />;
    default:
      return (
        <SlideEditor
          editMode={editMode}
          slide={slide}
          onSlideChange={(elements, appState, files) => updateSlide(currentSlideId, elements, appState, files)}
          key={currentSlideId}
        />
      );
  }
};

export default function SlidesEditorComponent({ metaData, presentationId, isEdit }: { metaData: { title: string; description: string }, presentationId: string, isEdit: boolean }) {
  const {
    slides,
    currentSlideId,
    editMode,
    setCurrentSlideId,
    setEditMode,
    addSlide,
    moveSlideUp,
    moveSlideDown,
    deleteSlide,
    getSlide,
    setSlides,
  } = useSlideStore();

  const router = useRouter();
  const [isSaving, setIsSaving] = useState<boolean>(false);


  const { isLoading, isError, data: presentation, isRefetching } = useGetSinglePresentation({ presentationId: presentationId, setSlides, setCurrentSlideId });

  const changeCurrentSlide = (id: string) => {
    setCurrentSlideId(id);
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const slideIndex = slides?.findIndex((s) => s.id === currentSlideId);
  const isFirstSlide = slideIndex === 0;
  const isLastSlide = slideIndex === slides?.length - 1;

  const goToNextSlide = () => {
    if (!isLastSlide) changeCurrentSlide(slides?.[slideIndex + 1]?.id);
  };

  const goToPreviousSlide = () => {
    if (!isFirstSlide) changeCurrentSlide(slides[slideIndex - 1].id);
  };

  const exportFile = () => {
    const a = document.createElement("a");
    a.setAttribute(
      "href",
      "data:application/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(slides, undefined, 2)),
    );
    a.setAttribute("download", "Untitled.excalidraw");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const importFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const json = e.target?.result as string;
        try {
          const slides = JSON.parse(json);
          setSlides(slides);
          setCurrentSlideId(slides[0]?.id);
          input.value = "";
        } catch (err) {
          alert("Something went wrong when importing the file.");
          console.error(err);
        }
      };
      reader.readAsText(input.files[0]);
    }
  };

  const takeScreenshot = async () => {
    try {
      const slideContainer = document.querySelector('.excalidraw__canvas');

      if (!slideContainer) {
        console.error('Slide container not found');
        return;
      }

      const canvas = await html2canvas(slideContainer as HTMLElement, {
        useCORS: true,
        scale: 2,
        logging: false,
        allowTaint: true,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          return;
        }

        const link = document.createElement('a');
        link.download = `slide_screenshot_${new Date().toISOString()}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      });
    } catch (error) {
      console.error('Screenshot failed:', error);
    }
  };

  // const exportToPowerPoint = async () => {
  //   try {
  //     const pptx = new PptxGenJS();

  //     for (const slide of slides) {
  //       const pptxSlide = pptx.addSlide();

  //       try {
  //         const slideContainer = document.querySelector(`.excalidraw__canvas`);

  //         if (!slideContainer) {
  //           console.warn(`Slide container for slide ${slide.id} not found`);
  //           continue;
  //         }

  //         const canvas = await html2canvas(slideContainer as HTMLElement, {
  //           useCORS: true,
  //           scale: 2,
  //           logging: false,
  //           allowTaint: true,
  //         });

  //         const imageData = canvas.toDataURL('image/png');

  //         pptxSlide.addImage({
  //           data: imageData,
  //           x: 0.5,
  //           y: 0.5,
  //           w: 9,
  //           h: 5.5,
  //         });
  //       } catch (slideError) {
  //         console.error(`Error processing slide ${slide.id}:`, slideError);
  //       }
  //     }

  //     pptx.writeFile({
  //       fileName: `Presentation_${new Date().toISOString().replace(/:/g, '-')}.pptx`
  //     });
  //   } catch (error) {
  //     console.error('PowerPoint export failed:', error);
  //   }
  // };

  const savePresentation = async () => {
    try {
      setIsSaving(true);

      // 1. Authentication check
      const accessToken = getTokenFromCookie(TokenKey.accessToken);
      if (!accessToken) {
        toast.error("Please login to save presentations");
        return;
      }

      // 2. Get institute ID
      const tokenData = getTokenDecodedData(accessToken);
      const INSTITUTE_ID = tokenData?.authorities && Object.keys(tokenData.authorities)[0];
      if (!INSTITUTE_ID) {
        toast.error("Organization information missing");
        return;
      }

      // 3. Validate slides data
      if (!slides || slides.length === 0) {
        toast.error("No slides to save");
        return;
      }

      // 4 & 5. Upload and transform slides
      const addedSlides = [];
      for (let index = 0; index < slides.length; index++) {
        const slide = slides[index];
        let fileId;

        try {
          fileId = await UploadFileInS3V2(
            slide,
            () => { },
            tokenData.sub,
            "SLIDES",
            tokenData.sub,
            true
          );
        } catch (uploadError) {
          console.error("Upload failed:", uploadError);
          toast.error("Failed to upload slides");
          return;
        }

        const isQuestionSlide = [SlideType.Quiz, SlideType.Feedback].includes(slide.type);

        const baseSlide = {
          id: slide.id ?? "",
          presentation_id: "",
          title: slide?.elements?.questionName || `Slide ${index + 1}`,
          source_id: fileId,
          source: isQuestionSlide ? "question" : "excalidraw",
          status: "PUBLISHED",
          interaction_status: "",
          slide_order: index,
          default_time: 0,
          content: fileId,
          added_question: null,
        };

        if (isQuestionSlide) {
          const question = {
            preview_id: "1",
            section_id: null,
            question_order_in_section: 1,
            text: {
              id: null,
              type: "HTML",
              content: slide?.elements?.questionText || "Question text"
            },
            media_id: "",
            question_response_type: "multiple_choice",
            question_type: "MCQS",
            access_level: "public",
            auto_evaluation_json: JSON.stringify({
              type: "MCQS",
              data: { correctOptionIds: slide?.elements?.correctOptions || [] }
            }),
            options_json: null,
            parsed_evaluation_object: {
              correct_option: slide?.elements?.correctOptions?.[0] || 1
            },
            evaluation_type: "auto",
            explanation_text: {
              id: null,
              type: "HTML",
              content: ""
            },
            parent_rich_text_id: "prt_001",
            parent_rich_text: {
              id: null,
              type: "HTML",
              content: ""
            },
            default_question_time_mins: slide?.elements?.timeLimit || 1,
            options: (slide?.elements?.singleChoiceOptions || []).map((option, optIndex) => ({
              id: isEdit ? option.id || "" : "",
              preview_id: `${optIndex + 1}`,
              question_id: isEdit ? slide.questionId || "" : "",
              text: {
                id: null,
                type: "HTML",
                content: option.text || `Option ${optIndex + 1}`
              },
              media_id:  "",
              option_order: optIndex,
              explanation_text: {
                id: null,
                type: "HTML",
                content:  ""
              }
            })),
            errors: [],
            warnings: []
          };
          baseSlide.added_question = question;
        }

        addedSlides.push(baseSlide);
      }

      // 6. Prepare final payload
      const payload = {
        id: isEdit ? presentationId : "",
        title: metaData?.title || "New Presentation",
        description: metaData?.description || "",
        cover_file_id: "",
        added_slides: filterSlidesByIdType(addedSlides, true),
        status: "PUBLISHED",

      };

      if (isEdit) {
        payload.updated_slides =  filterSlidesByIdType(addedSlides, false)
        payload.deleted_slides = []
      }

      // 7. Make API call
      await authenticatedAxiosInstance.post(
        isEdit ? EDIT_PRESENTATION : ADD_PRESENTATION,
        payload,
        {
          params: { instituteId: INSTITUTE_ID },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      toast.success(`Presentation ${isEdit ? "updated" : "created"} successfully`);
      router.navigate({ to: '/study-library/present' });

    } catch (error) {
      console.error("Save error:", error);
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Failed to save presentation"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isRefetching) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="animate-spin size-10 text-primary-300" />
      </div>
    );
  }
  return (
    <div className="flex h-screen w-full bg-white">
      <div className="flex size-full flex-col rounded-xl bg-base-white">
        <div className="flex justify-between  bg-primary-200 p-1 mb-1 min-h-32">
          <div className="flex gap-2 justify-end " >
            <IoArrowBackSharp size={36} className="text-primary-400 cursor-pointer" onClick={() => router.navigate({ to: '/study-library/present' })} />
            <Button
              variant="destructive"
              onClick={savePresentation}
              className="gap-2 bg-primary-400  hover:bg-primary-500 "
            >
              <Save className="size-4" />
              {isSaving ? "Saving..." : isEdit ? "Save Presentation" : "Add Presentation"}
            </Button>
          </div>
          <div className="flex justify-end gap-2 ">
            {/* <Button
              variant="destructive"
              onClick={takeScreenshot}
              className="gap-2"
            >
              <Settings className="size-4" />
              SnapShot
            </Button> */}
            {/* <Button
              variant="destructive"
              onClick={exportToPowerPoint}
              className="gap-2"
            >
              <FileDown className="size-4" />
              Export PPT
            </Button> */}
            <Button
              variant="ghost"
              onClick={toggleEditMode}
              className="gap-2 bg-primary-400"
            >
              <ListStart className="size-4" />
              {editMode ? "Start" : "Edit"}
            </Button>
          </div>
        </div>

        <div className="slide-container flex bg-primary-100" style={{ position: 'relative' }}>
          {currentSlideId && (
            <div className={`slide-${currentSlideId}`} style={{
              display: 'block',
              height: '100%'
            }}>
              <SlideList
                slides={slides}
                currentSlide={currentSlideId}
                onSlideChange={changeCurrentSlide}
                onAddSlide={addSlide}
                onMoveSlideUp={moveSlideUp}
                onMoveSlideDown={moveSlideDown}
                onDeleteSlide={() => deleteSlide(currentSlideId)}
                onExport={exportFile}
                onImport={importFile}
                onReorderSlides={(slides) => {
                  setSlides(slides);
                }}
              />
            </div>
          )}
          <div className="flex flex-1 flex-col bg-white">
            <div className="relative flex-1 rounded-xl border-2 border-primary-300">
              {!editMode && (
                <div className="absolute inset-0 z-10 rounded-lg bg-black/50" />
              )}

              {(!isLoading && currentSlideId) && (
                <SlideRenderer
                  currentSlideId={currentSlideId}
                  type={getSlide(currentSlideId)?.type || SlideType.Title}
                  editMode={editMode}
                  key={currentSlideId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}