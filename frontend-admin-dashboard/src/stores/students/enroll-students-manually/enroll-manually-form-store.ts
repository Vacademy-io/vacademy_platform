import { create } from "zustand";
import { StepTwoData } from "@/schemas/student/student-list/schema-enroll-students-manually";
import { StepThreeData } from "@/schemas/student/student-list/schema-enroll-students-manually";
import { StepFourData } from "@/schemas/student/student-list/schema-enroll-students-manually";
import { StepFiveData } from "@/schemas/student/student-list/schema-enroll-students-manually";

// For step one, since it's just a file upload
export interface StepOneDataType {
    profilePicture?: string | null | undefined; // This will now store the file ID instead of URL
    profilePictureUrl?: string | null | undefined; // For display purposes
}

interface FormStore {
    // Current step
    currentStep: number;

    // Form data using schema types
    stepOneData: StepOneDataType | null;
    stepTwoData: StepTwoData | null;
    stepThreeData: StepThreeData | null;
    stepFourData: StepFourData | null;
    stepFiveData: StepFiveData | null;

    // Actions
    setStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    skipStep: () => void;

    // Data setters
    setStepOneData: (data: StepOneDataType) => void;
    setStepTwoData: (data: StepTwoData) => void;
    setStepThreeData: (data: StepThreeData) => void;
    setStepFourData: (data: StepFourData) => void;
    setStepFiveData: (data: StepFiveData) => void;

    // Reset form
    resetForm: () => void;
}

export const useFormStore = create<FormStore>((set) => ({
    currentStep: 1,

    // Initialize form data
    stepOneData: null,
    stepTwoData: null,
    stepThreeData: null,
    stepFourData: null,
    stepFiveData: null,

    // Navigation actions
    setStep: (step) => set({ currentStep: step }),
    nextStep: () =>
        set((state) => ({
            currentStep: state.currentStep < 5 ? state.currentStep + 1 : state.currentStep,
        })),
    prevStep: () =>
        set((state) => ({
            currentStep: state.currentStep > 1 ? state.currentStep - 1 : state.currentStep,
        })),
    skipStep: () =>
        set((state) => ({
            currentStep: state.currentStep === 1 ? 2 : state.currentStep,
        })),

    // Data setters
    setStepOneData: (data) => set({ stepOneData: data }),
    setStepTwoData: (data) => set({ stepTwoData: data }),
    setStepThreeData: (data) => set({ stepThreeData: data }),
    setStepFourData: (data) => set({ stepFourData: data }),
    setStepFiveData: (data) => set({ stepFiveData: data }),

    // Reset function
    resetForm: () =>
        set({
            currentStep: 1,
            stepOneData: null,
            stepTwoData: null,
            stepThreeData: null,
            stepFourData: null,
            stepFiveData: null,
        }),
}));
