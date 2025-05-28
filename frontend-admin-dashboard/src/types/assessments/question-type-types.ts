import { Dispatch, SetStateAction } from "react";
import { QuestionType as QuestionTypeList } from "@/constants/dummy-data";

export interface CollapsibleQuillEditorProps {
    value: string | null | undefined;
    onChange: (content: string) => void;
}

// export interface QuestionTypeProps {
//     icon: React.ReactNode; // Accepts an SVG or any React component
//     text: string; // Accepts the text label
//     type?: QuestionTypeList;
// }
export interface QuestionPaperHeadingInterface {
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    isDirectAdd?: boolean;
    handleSelect?: (tyep: string) => void;
}

export interface QuestionTypeProps {
    isDirectAdd?: boolean;
    handleSelect?: (tyep: string) => void;
    icon: React.ReactNode; // Accepts an SVG or any React component
    text: string; // Accepts the text label
    type?: QuestionTypeList;
}
