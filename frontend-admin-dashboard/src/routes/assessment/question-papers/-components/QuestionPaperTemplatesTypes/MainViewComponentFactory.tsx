import React from "react";
import { QuestionPaperTemplateFormProps } from "../../-utils/question-paper-template-form";
import { SingleCorrectQuestionPaperTemplateMainView } from "./MCQ(Single Correct)/SingleCorrectQuestionPaperTemplateMainView";
import { NumericQuestionPaperTemplateMainView } from "./NumericType/NumericQuestionPaperTemplateMainView";
import { MultipleCorrectQuestionPaperTemplateMainView } from "./MCQ(Multiple Correct)/MultipleCorrectQuestionPaperTemplateMainView";
import { ComprehensiveSingleCorrectQuestionPaperTemplateMainView } from "./Comprehensive MCQ(Single Correct)/ComprehensiveSingleCorrectQuestionPaperTemplateMainView";
import { QuestionType } from "@/constants/dummy-data";
import { ComprehensiveMultipleCorrectQuestionPaperTemplateMainView } from "./Comprehensive MCQ(Multiple Correct)/ComprehensiveMultipleCorrectQuestionPaperTemplateMainView";
import { ComprehensiveNumericQuestionPaperTemplateMainView } from "./ComprehensiveNumericType/ComprehensiveNumericQuestionPaperTemplateMainView";
import { OneWordQuestionPaperTemplateMainView } from "./OneWordType/OneWordQuestionPaperTemplateMainView";
import { LongAnswerQuestionPaperTemplateMainView } from "./LongAnswerType/LongAnswerQuestionPaperTemplateMainView";
import { TrueFalseQuestionPaperTemplateMainView } from "./TrueFalse/TrueFalseQuestionPaperTemplateMainView";

type MainViewComponentType = QuestionType;

type MainViewComponent = (props: QuestionPaperTemplateFormProps) => React.ReactElement;

const MainViewComponentsMap: Record<MainViewComponentType, MainViewComponent> = {
    MCQS: SingleCorrectQuestionPaperTemplateMainView,
    MCQM: MultipleCorrectQuestionPaperTemplateMainView,
    NUMERIC: NumericQuestionPaperTemplateMainView,
    CMCQS: ComprehensiveSingleCorrectQuestionPaperTemplateMainView,
    CMCQM: ComprehensiveMultipleCorrectQuestionPaperTemplateMainView,
    CNUMERIC: ComprehensiveNumericQuestionPaperTemplateMainView,
    ONE_WORD: OneWordQuestionPaperTemplateMainView,
    LONG_ANSWER: LongAnswerQuestionPaperTemplateMainView,
    TRUE_FALSE: TrueFalseQuestionPaperTemplateMainView,
};

export const MainViewComponentFactory = (params: {
    type: MainViewComponentType;
    props: QuestionPaperTemplateFormProps;
}) => {
    const Component = MainViewComponentsMap[params.type];
    return <Component {...params.props} />;
};
