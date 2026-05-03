import { create } from 'zustand';
import type { CompanySize, VimotionAccountType } from '../api/types';

export type OnboardingStep = 'contact' | 'otp' | 'account-type' | 'studio-details';

export interface ContactDetails {
    fullName: string;
    email: string;
    phoneNumber: string;
}

export interface StudioDetails {
    studioName: string;
    logoFileId?: string;
    brandColor: string;
    companySize: CompanySize;
}

interface OnboardingState {
    step: OnboardingStep;
    contact: ContactDetails;
    signupToken: string | null;
    signupTokenExpiresAt: number | null;
    accountType: VimotionAccountType | null;
    studio: StudioDetails;

    setStep: (step: OnboardingStep) => void;
    setContact: (contact: Partial<ContactDetails>) => void;
    setSignupToken: (token: string, expiresAt: number) => void;
    setAccountType: (type: VimotionAccountType) => void;
    setStudio: (studio: Partial<StudioDetails>) => void;
    reset: () => void;
}

const initialContact: ContactDetails = {
    fullName: '',
    email: '',
    phoneNumber: '',
};

const initialStudio: StudioDetails = {
    studioName: '',
    logoFileId: undefined,
    brandColor: '#FF6B00',
    companySize: '1-10',
};

export const useVimotionOnboardingStore = create<OnboardingState>((set) => ({
    step: 'contact',
    contact: initialContact,
    signupToken: null,
    signupTokenExpiresAt: null,
    accountType: null,
    studio: initialStudio,

    setStep: (step) => set({ step }),
    setContact: (contact) => set((s) => ({ contact: { ...s.contact, ...contact } })),
    setSignupToken: (signupToken, signupTokenExpiresAt) =>
        set({ signupToken, signupTokenExpiresAt }),
    setAccountType: (accountType) => set({ accountType }),
    setStudio: (studio) => set((s) => ({ studio: { ...s.studio, ...studio } })),
    reset: () =>
        set({
            step: 'contact',
            contact: initialContact,
            signupToken: null,
            signupTokenExpiresAt: null,
            accountType: null,
            studio: initialStudio,
        }),
}));
