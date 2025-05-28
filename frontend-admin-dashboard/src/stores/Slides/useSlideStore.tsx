/* eslint-disable */
// @ts-nocheck
import { create } from 'zustand';
import { Slide } from '@/components/common/slides/types';
import { defaultSlides } from '@/components/common/slides/constant/defaultSlides';
import { SlideType } from '@/components/common/slides/constant/slideType';
import { createNewSlide } from '@/components/common/slides/utils/util';

interface SlideStore {
  slides: Slide[];
  currentSlideId: string | undefined;
  editMode: boolean;
  setSlides: (slides: Slide[]) => void;
  setCurrentSlideId: (id: string) => void;
  setEditMode: (editMode: boolean) => void;
  getSlide: (id: string) => Slide | undefined;
  updateSlide: (id: string, elements: any[] , appState: any, files: any) => void;
  addSlide: (type: SlideType) => void;
  deleteSlide: (id: string) => void;
  moveSlideUp: (id: string) => void;
  moveSlideDown: (id: string) => void;
  updateQuizeSlide: (id: string, elements: any) => void;
}

export const useSlideStore = create<SlideStore>((set, get) => {
  // Initialize from localStorage or default
  const savedSlides = localStorage.getItem("slides");
  const initialSlides = savedSlides && savedSlides.length > 0 ? JSON.parse(savedSlides) : defaultSlides;
  console.log(initialSlides, 'initialSlides')

  return {
    slides: initialSlides,
    currentSlideId: initialSlides[0]?.id,
    editMode: true,
    setSlides: (slides) => {
      localStorage.setItem("slides", JSON.stringify(slides));
      set({ slides });
    },
    setCurrentSlideId: (currentSlideId) => set({ currentSlideId }),
    setEditMode: (editMode) => set({ editMode }),
    getSlide: (id) => get().slides.find((s) => s.id === id),
    updateSlide: (id, elements, appState, files) => {
      const newSlides = get().slides.map((slide) =>
        slide.id === id ? { ...slide, elements: elements.filter((e) => !e.isDeleted), files: files, appState: appState } : slide
      );
      get().setSlides(newSlides);
    },
    addSlide: (type) => {
      const newSlide = createNewSlide(type);
      const newSlides = [...get().slides, newSlide];
      get().setSlides(newSlides);
      get().setCurrentSlideId(newSlide.id);
    },
    deleteSlide: (id) => {
      const slides = get().slides;
      if (slides.length === 1) return;

      const slideIndex = slides.findIndex((s) => s.id === id);
      const isLastSlide = slideIndex === slides.length - 1;

      const newSlides = slides.filter((s) => s.id !== id);
      get().setSlides(newSlides);

      if (isLastSlide) {
        get().setCurrentSlideId(newSlides[newSlides.length - 1].id);
      } else {
        get().setCurrentSlideId(newSlides[slideIndex].id);
      }
    },
    moveSlideUp: (id) => {
      const slides = get().slides;
      const slideIndex = slides.findIndex((s) => s.id === id);
      if (slideIndex === 0) return;

      const newSlides = [...slides];
      const temp = newSlides[slideIndex];
      newSlides[slideIndex] = newSlides[slideIndex - 1];
      newSlides[slideIndex - 1] = temp;

      get().setSlides(newSlides);
    },
    moveSlideDown: (id) => {
      const slides = get().slides;
      const slideIndex = slides.findIndex((s) => s.id === id);
      if (slideIndex === slides.length - 1) return;

      const newSlides = [...slides];
      const temp = newSlides[slideIndex];
      newSlides[slideIndex] = newSlides[slideIndex + 1];
      newSlides[slideIndex + 1] = temp;

      get().setSlides(newSlides);
    },

    updateQuizeSlide: (id, elements) => {
      const newSlides = get().slides.map((slide) =>
        slide.id === id ? { ...slide, elements: elements } : slide
      );
      get().setSlides(newSlides);
    },
  };
});