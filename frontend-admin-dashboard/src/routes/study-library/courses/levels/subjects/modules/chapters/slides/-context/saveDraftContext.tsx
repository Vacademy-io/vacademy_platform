// 1. Create a new file called save-draft-context.tsx
import { createContext, useContext } from "react";
import { Slide } from "@/routes/study-library/courses/levels/subjects/modules/chapters/slides/-hooks/use-slides";

interface SaveDraftContextType {
    getCurrentEditorHTMLContent: () => string;
    saveDraft: (slide: Slide) => Promise<void>;
}

const SaveDraftContext = createContext<SaveDraftContextType>({
    getCurrentEditorHTMLContent: () => "",
    saveDraft: async () => {},
});

export const useSaveDraft = () => useContext(SaveDraftContext);

export const SaveDraftProvider: React.FC<{
    children: React.ReactNode;
    getCurrentEditorHTMLContent: () => string;
    saveDraft: (slide: Slide) => Promise<void>;
}> = ({ children, getCurrentEditorHTMLContent, saveDraft }) => {
    return (
        <SaveDraftContext.Provider value={{ getCurrentEditorHTMLContent, saveDraft }}>
            {children}
        </SaveDraftContext.Provider>
    );
};
