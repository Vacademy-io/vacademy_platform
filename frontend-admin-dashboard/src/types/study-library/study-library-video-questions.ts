export interface MyQuestionPaperFormInterface {
    questionPaperId?: string; // Optional string
    isFavourite?: boolean; // Default value: false
    title?: string; // Required string
    createdOn?: Date; // Default value: current date
    yearClass?: string; // Required string
    subject?: string; // Required string
    questionsType?: string; // Required string
    optionsType?: string; // Required string
    answersType?: string; // Required string
    explanationsType?: string; // Required string
    fileUpload?: File; // Optional file
    questions?: StudyLibraryQuestion[]; // Required array of questions
}

export interface StudyLibraryQuestion {
    id?: string;
    questionId?: string; // Optional string
    questionName: string; // Required string, must have at least 1 character
    explanation?: string; // Optional string
    questionType: string; // Default value: "MCQS"
    questionMark: string; // Required string
    questionPenalty: string;
    questionDuration: {
        hrs: string;
        min: string;
    };
    singleChoiceOptions?: MySingleChoiceOption[]; // Array of single choice options
    multipleChoiceOptions?: MyMultipleChoiceOption[]; // Array of multiple choice options
    csingleChoiceOptions?: MySingleChoiceOption[]; // Array of single choice options
    cmultipleChoiceOptions?: MyMultipleChoiceOption[]; // Array of multiple choice options
    trueFalseOptions?: MyMultipleChoiceOption[]; // Array of multiple choice options
    validAnswers?: number[] | null;
    decimals?: number;
    numericType?: string;
    parentRichTextContent?: string | null;
    subjectiveAnswerText?: string;
    timestamp?: string;
    canSkip?: boolean;
}

export interface MySingleChoiceOption {
    id?: string;
    name?: string; // Optional string
    isSelected?: boolean; // Optional boolean
}

export interface MyMultipleChoiceOption {
    id?: string;
    name?: string; // Optional string
    isSelected?: boolean; // Optional boolean
}
