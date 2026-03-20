import { SupportedLanguage } from '../constants/code-editor';

export interface LanguageState {
    code: string;
    lastEdited?: number;
}

export interface AllLanguagesData {
    python: LanguageState;
    javascript: LanguageState;
}

export interface CodeEditorData {
    language: SupportedLanguage;
    code: string;
    theme: 'light' | 'dark';
    viewMode: 'view' | 'edit';
    // Add support for both languages' data
    allLanguagesData?: AllLanguagesData;
}

export interface CodeEditorSlideProps {
    codeData?: CodeEditorData;
    isEditable: boolean;
    onDataChange?: (newData: CodeEditorData) => void;
}
