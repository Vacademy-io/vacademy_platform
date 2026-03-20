export type FormValues = {
    title: string;
    questions: {
        questions: {
            questionName: string;
            option1: { name: string; isSelected: boolean };
            option2: { name: string; isSelected: boolean };
            option3: { name: string; isSelected: boolean };
            option4: { name: string; isSelected: boolean };
            questionId?: string;
            explanation?: string;
            imageDetails?: unknown; // Replace `unknown` with the appropriate type if available
        }[];
    };
};
