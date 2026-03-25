import { createContext, useContext, useState, ReactNode } from 'react';

interface AICenterContextType {
    loader: boolean;
    setLoader: (value: boolean) => void;
    key: string | null;
    setKey: (value: string | null) => void;
}

const AICenterContext = createContext<AICenterContextType | undefined>(undefined);

export function AICenterProvider({ children }: { children: ReactNode }) {
    const [loader, setLoader] = useState(false);
    const [key, setKey] = useState<string | null>(null);

    return (
        <AICenterContext.Provider value={{ loader, setLoader, key, setKey }}>
            {children}
        </AICenterContext.Provider>
    );
}

export function useAICenter() {
    const context = useContext(AICenterContext);
    if (context === undefined) {
        throw new Error('useAICenter must be used within an AICenterProvider');
    }
    return context;
}
