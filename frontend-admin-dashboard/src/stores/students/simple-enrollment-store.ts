import { create } from 'zustand';

interface SimpleEnrollmentStore {
    isModalOpen: boolean;
    enrollmentType: 'RENT' | 'BUY' | 'MEMBERSHIP' | null;
    selectedStudentId: string | null;
    currentStep: number;

    // Multi-Selection Data
    selectedItems: Array<{
        id: string; // Internal unique tracking ID (usually plan_id or session_id)
        name: string;
        price: number;
        type: string;
        session: string;
        // V2 API Specific metadata
        package_session_id: string;
        plan_id: string;
        payment_option_id: string;
        enroll_invite_id: string;
    }>;

    // Actions
    openModal: (type: 'RENT' | 'BUY' | 'MEMBERSHIP', studentId: string) => void;
    closeModal: () => void;
    setStep: (step: number) => void;
    toggleItem: (item: any) => void;
    clearSelection: () => void;
}

export const useSimpleEnrollmentStore = create<SimpleEnrollmentStore>((set) => ({
    isModalOpen: false,
    enrollmentType: null,
    selectedStudentId: null,
    currentStep: 1,
    selectedItems: [],

    openModal: (type, studentId) => set({
        isModalOpen: true,
        enrollmentType: type,
        selectedStudentId: studentId,
        currentStep: 1,
        selectedItems: []
    }),

    closeModal: () => set({
        isModalOpen: false,
        enrollmentType: null,
        selectedStudentId: null,
        selectedItems: []
    }),

    setStep: (step) => set({ currentStep: step }),

    toggleItem: (item) => set((state) => {
        const isSelected = state.selectedItems.some(i => i.id === item.id);
        if (isSelected) {
            return { selectedItems: state.selectedItems.filter(i => i.id !== item.id) };
        } else {
            return { selectedItems: [...state.selectedItems, item] };
        }
    }),

    clearSelection: () => set({ selectedItems: [] }),
}));
