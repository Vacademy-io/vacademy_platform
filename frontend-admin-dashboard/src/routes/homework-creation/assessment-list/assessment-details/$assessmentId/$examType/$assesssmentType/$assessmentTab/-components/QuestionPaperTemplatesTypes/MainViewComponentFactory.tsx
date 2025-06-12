import React from "react";
import { SingleCorrectQuestionPaperTemplateMainView } from "./MCQ(Single Correct)/SingleCorrectQuestionPaperTemplateMainView";
import { MultipleCorrectQuestionPaperTemplateMainView } from "./MCQ(Multiple Correct)/MultipleCorrectQuestionPaperTemplateMainView";
import { SectionQuestionPaperFormProps } from "../../-utils/assessment-question-paper";

type MainViewComponentType = "MCQS" | "MCQM";

type MainViewComponent = (props: SectionQuestionPaperFormProps) => React.ReactElement;

const MainViewComponentsMap: Record<MainViewComponentType, MainViewComponent> = {
    MCQS: SingleCorrectQuestionPaperTemplateMainView,
    MCQM: MultipleCorrectQuestionPaperTemplateMainView,
};

export const MainViewComponentFactory = (params: {
    type: MainViewComponentType;
    props: SectionQuestionPaperFormProps;
}) => {
    const Component = MainViewComponentsMap[params.type];
    return <Component {...params.props} />;
};
