import React, { createContext, useContext, ReactNode } from 'react';
import { useInstitute } from '@/hooks/auth/useInstitute';
import { Institute } from '@/lib/auth/instituteUtils';

interface InstituteContextType {
    currentInstituteId: string | undefined;
    isLoading: boolean;
    selectInstitute: (instituteId: string) => void;
    clearInstitute: () => void;
    getCurrentInstituteRole: () => string | null;
    getInstituteSelectionStatus: () => any;
}

const InstituteContext = createContext<InstituteContextType | undefined>(undefined);

interface InstituteProviderProps {
    children: ReactNode;
}

export function InstituteProvider({ children }: InstituteProviderProps) {
    const instituteHook = useInstitute();

    return (
        <InstituteContext.Provider value={instituteHook}>
            {children}
        </InstituteContext.Provider>
    );
}

export function useInstituteContext() {
    const context = useContext(InstituteContext);
    if (context === undefined) {
        throw new Error('useInstituteContext must be used within an InstituteProvider');
    }
    return context;
}
