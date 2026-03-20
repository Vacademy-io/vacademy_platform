import { createContext, useContext, useState, ReactNode } from 'react';

interface SelectedEnquirySidebarContextType {
    selectedEnquiryId: string | null;
    isOpen: boolean;
    openSidebar: (enquiryId: string) => void;
    closeSidebar: () => void;
}

const SelectedEnquirySidebarContext = createContext<SelectedEnquirySidebarContextType | null>(null);

export const SelectedEnquirySidebarProvider = ({ children }: { children: ReactNode }) => {
    const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const openSidebar = (enquiryId: string) => {
        setSelectedEnquiryId(enquiryId);
        setIsOpen(true);
    };

    const closeSidebar = () => {
        setIsOpen(false);
        setSelectedEnquiryId(null);
    };

    return (
        <SelectedEnquirySidebarContext.Provider
            value={{ selectedEnquiryId, isOpen, openSidebar, closeSidebar }}
        >
            {children}
        </SelectedEnquirySidebarContext.Provider>
    );
};

export const useEnquirySidebar = (): SelectedEnquirySidebarContextType => {
    const ctx = useContext(SelectedEnquirySidebarContext);
    if (!ctx) {
        throw new Error('useEnquirySidebar must be used within SelectedEnquirySidebarProvider');
    }
    return ctx;
};
