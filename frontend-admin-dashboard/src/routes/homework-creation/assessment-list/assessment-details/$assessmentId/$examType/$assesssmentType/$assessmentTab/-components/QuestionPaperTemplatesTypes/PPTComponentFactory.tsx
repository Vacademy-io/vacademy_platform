import React from "react";
import { SingleCorrectQuestionPaperTemplatePPTView } from "./MCQ(Single Correct)/SingleCorrectQuestionPaperTemplatePPTView";
import { MultipleCorrectQuestionPaperTemplatePPTView } from "./MCQ(Multiple Correct)/MultipleCorrectQuestionPaperTemplatePPTView";
import { SectionQuestionPaperFormProps } from "../../-utils/assessment-question-paper";

type PPTComponentType = "MCQS" | "MCQM";

type PPTComponent = (props: SectionQuestionPaperFormProps) => React.ReactElement;

const PPTComponentsMap: Record<PPTComponentType, PPTComponent> = {
    MCQS: SingleCorrectQuestionPaperTemplatePPTView,
    MCQM: MultipleCorrectQuestionPaperTemplatePPTView,
};

export const PPTComponentFactory = (params: {
    type: PPTComponentType;
    props: SectionQuestionPaperFormProps;
}) => {
    const Component = PPTComponentsMap[params.type];
    return <Component {...params.props} />;
};
