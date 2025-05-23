// src/contexts/InviteFormContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useInviteForm } from '../-hooks/useInviteForm';
import { InviteForm } from '../-schema/InviteFormSchema';

type InviteFormContextType = ReturnType<typeof useInviteForm>;

const InviteFormContext = createContext<InviteFormContextType | null>(null);

export const InviteFormProvider = ({
    children,
    initialValues,
}: {
    children: ReactNode;
    initialValues?: InviteForm;
}) => {
    const formMethods = useInviteForm(initialValues);

    return <InviteFormContext.Provider value={formMethods}>{children}</InviteFormContext.Provider>;
};

export const useInviteFormContext = () => {
    const context = useContext(InviteFormContext);
    if (!context) {
        throw new Error('useInviteFormContext must be used within an InviteFormProvider');
    }
    return context;
};
