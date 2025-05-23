interface ImageDetails {
    imageId?: string;
    imageName: string;
    imageTitle?: string;
    imageFile: string;
    isDeleted?: boolean;
}

interface ChoiceOption {
    name?: string;
    isSelected?: boolean;
    image: {
        imageId?: string;
        imageName?: string;
        imageTitle?: string;
        imageFile?: string;
        isDeleted?: boolean;
    };
}

interface QuestionDuration {
    hrs: string;
    min: string;
}

export interface QuestionAssessmentPreview {
    id: string;
    questionId?: string;
    questionName: string;
    explanation?: string;
    questionType: string; // Default is "MCQS"
    questionPenalty: string;
    questionDuration: QuestionDuration;
    questionMark: string;
    imageDetails?: ImageDetails[];
    singleChoiceOptions: ChoiceOption[];
    multipleChoiceOptions: ChoiceOption[];
}
